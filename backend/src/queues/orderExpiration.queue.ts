import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import mongoose from 'mongoose';
import Order from '../models/order.model';
import redisClient from '../utils/redisClient';
import { REDIS_URL } from '../config';
import Seat from '../models/seat.model';
import { getReservationState } from '../domain/reservation';
import { assertOrderTransition, type OrderStatus } from '../domain/order-transition';
import { finalizeReleasedSeatMetadata } from '../services/zone-summary.service';

export interface OrderExpirationJobData {
    order_id: string | mongoose.Types.ObjectId;
    event_id: string;
    zone_id: string;
    show_id: string;
    seat_ids: string[];
}

const connection = new IORedis(REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});

const releaseSeatsLuaScript = `
    local rowKey = KEYS[1]
    local userCountKey = KEYS[2]
    local lockCount = tonumber(ARGV[1]) or 0
    local rowStr = redis.call('GET', rowKey)
    if not rowStr then return nil end

    local chars = {}
    for i = 1, #rowStr do
        chars[i] = rowStr:sub(i, i)
    end

    for i = 1, lockCount do
        local colIndex = tonumber(ARGV[1 + i])
        if chars[colIndex] == 'H' then
            chars[colIndex] = 'O'
        end
    end

    local newRowStr = table.concat(chars)
    redis.call('SET', rowKey, newRowStr)

    for i = 1, lockCount do
        redis.call('DEL', KEYS[2 + i])
    end

    if lockCount > 0 then
        local currentCount = tonumber(redis.call('GET', userCountKey) or 0)
        if currentCount >= lockCount then
            redis.call('DECRBY', userCountKey, lockCount)
        else
            redis.call('SET', userCountKey, 0)
        end
    end

    local summaryKey = KEYS[3 + lockCount]
    local releasedByTier = {}
    for i = 1, lockCount do
        local ticketTypeId = ARGV[1 + lockCount + i]
        if ticketTypeId and ticketTypeId ~= '' then
            releasedByTier[ticketTypeId] = (releasedByTier[ticketTypeId] or 0) + 1
        end
    end
    for ticketTypeId, count in pairs(releasedByTier) do
        redis.call('HINCRBY', summaryKey, 'tier:' .. ticketTypeId .. ':count', count)
    end

    local validSet = {}
    for chunk in string.gmatch(newRowStr, 'O+') do
        local maxQuantity = math.min(#chunk, 4)
        for quantity = 1, maxQuantity do
            if #chunk - quantity ~= 1 then validSet[quantity] = true end
        end
    end
    local validQuantities = {}
    for quantity = 1, 4 do
        if validSet[quantity] then table.insert(validQuantities, quantity) end
    end
    if #validQuantities == 0 then
        redis.call('HSET', summaryKey, 'valid_quantities', '[]')
    else
        redis.call('HSET', summaryKey, 'valid_quantities', cjson.encode(validQuantities))
    end

    return newRowStr
`;
let orderExpirationWorker: Worker<OrderExpirationJobData> | null = null;

export const startOrderExpirationWorker = (): Worker<OrderExpirationJobData> => {
    if (orderExpirationWorker) {
        return orderExpirationWorker;
    }

    orderExpirationWorker = new Worker<OrderExpirationJobData>(
        'order-expiration',
        processOrderExpiration,
        {
            connection,
            concurrency: 5,
        },
    );

    orderExpirationWorker.on('failed', (job, error) => {
        console.error(
            `[BullMQ] Job ${job?.id} thất bại. Cần can thiệp tay! Lỗi:`,
            error,
        );
    });

    return orderExpirationWorker;
};

export const orderExpirationQueue = new Queue<OrderExpirationJobData>('order-expiration', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'fixed',
            delay: 5000,
        },
        removeOnComplete: true,
    }
});

export const processOrderExpiration = async (
    job: Pick<Job<OrderExpirationJobData>, 'data' | 'id'>,
): Promise<'expired' | 'skipped'> => {
    const { order_id, event_id, zone_id, show_id, seat_ids } = job.data;
    console.log(`[BullMQ] Bắt đầu kiểm tra đơn hàng quá hạn: ${order_id}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const order = await Order.findById(order_id).session(session);
        if (!order || getReservationState(order as any) !== 'expired') {
            await session.abortTransaction();
            console.log(`[BullMQ] Đơn ${order_id} chưa hết hạn hoặc đã được xử lý. Bỏ qua.`);
            return 'skipped';
        }

        assertOrderTransition(order.status as OrderStatus, 'cancelled');
        order.status = 'cancelled';
        await order.save({ session });

        const seatsToRelease = await Seat.find({ _id: { $in: seat_ids } }).session(session);
        const seatsByRow: Record<string, typeof seatsToRelease> = {};

        seatsToRelease.forEach(seat => {
            if (!seatsByRow[seat.row]) seatsByRow[seat.row] = [];
            seatsByRow[seat.row].push(seat);
        });

        for (const rowLabel in seatsByRow) {
            const seatsInRow = seatsByRow[rowLabel];
            const rowKey = `event:${event_id}:show:${show_id}:zone:${zone_id}:row:${rowLabel}`;
            const keys = [rowKey, `event:${event_id}:show:${show_id}:user:${order.user_id}:held_count`];
            const args: string[] = [String(seatsInRow.length)];

            seatsInRow.forEach(seat => {
                keys.push(`event:${event_id}:show:${show_id}:seat:${seat._id}:lock`);
                args.push(String(seat.col_index));
            });
            keys.push(`event:${event_id}:show:${show_id}:zone:${zone_id}:summary`);
            seatsInRow.forEach(seat => {
                args.push(seat.ticket_type_id?.toString?.() || '');
            });

            await redisClient.eval(releaseSeatsLuaScript, {
                keys,
                arguments: args,
            });
        }

        const { releasedSeatIds } = await finalizeReleasedSeatMetadata({
            eventId: String(event_id),
            showId: String(show_id),
            zoneId: String(zone_id),
            seats: seatsToRelease.map(seat => ({
                id: seat._id.toString(),
                row: seat.row,
                colIndex: Number(seat.col_index),
                ticketTypeId: seat.ticket_type_id?.toString?.() || null,
            })),
        });

        for (const seat_id of releasedSeatIds) {
            await redisClient.publish('SEAT_UPDATES', JSON.stringify({
                show_id,
                seat_id,
                status: 'available'
            }));
        }

        await session.commitTransaction();
        console.log(`[BullMQ] Đã hủy đơn ${order_id}, nhả khóa và khôi phục chuỗi thành công.`);
        return 'expired';
    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error(`[BullMQ] Lỗi xử lý đơn ${order_id}:`, error);
        throw error;
    } finally {
        await session.endSession();
    }
};


export const closeOrderExpirationInfrastructure =
    async (): Promise<void> => {
        const worker = orderExpirationWorker;
        orderExpirationWorker = null;

        if (worker) {
            await worker.close();
        }

        await orderExpirationQueue.close();

        if (connection.status !== 'end') {
            await connection.quit();
        }
    };
