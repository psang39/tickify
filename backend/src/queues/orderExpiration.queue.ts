import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import mongoose from 'mongoose';
import Order from '../models/order.model';
import redisClient from '../utils/redisClient';
import { REDIS_URL } from '../config';
import { calculateValidQuantities } from '../utils/validQuantities';
import { formatHashToJSON } from '../utils/hashToJson';
import Seat from '../models/seat.model';
import { getReservationState } from '../domain/reservation';
import { assertOrderTransition, type OrderStatus } from '../domain/order-transition';

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
    local rowStr = redis.call('GET', rowKey)
    if not rowStr then return nil end

    local chars = {}
    for i = 1, #rowStr do
        chars[i] = rowStr:sub(i, i)
    end

    local numSeatsToRelease = #ARGV
    for i = 1, numSeatsToRelease do
        local colIndex = tonumber(ARGV[i])
        if chars[colIndex] == 'H' then
            chars[colIndex] = 'O'
        end
    end

    local newRowStr = table.concat(chars)
    redis.call('SET', rowKey, newRowStr)

    for i = 3, #KEYS do
        redis.call('DEL', KEYS[i])
    end

    if numSeatsToRelease > 0 then
        local currentCount = tonumber(redis.call('GET', userCountKey) or 0)
        if currentCount >= numSeatsToRelease then
            redis.call('DECRBY', userCountKey, numSeatsToRelease)
        else
            redis.call('SET', userCountKey, 0)
        end
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
        const releaseByTier: Record<string, number> = {};

        seatsToRelease.forEach(seat => {
            if (!seatsByRow[seat.row]) seatsByRow[seat.row] = [];
            seatsByRow[seat.row].push(seat);
            const ticketTypeId = seat.ticket_type_id?.toString?.();
            if (ticketTypeId) releaseByTier[ticketTypeId] = (releaseByTier[ticketTypeId] || 0) + 1;
        });

        const updatedRowStrings: string[] = [];
        for (const rowLabel in seatsByRow) {
            const seatsInRow = seatsByRow[rowLabel];
            const rowKey = `event:${event_id}:show:${show_id}:zone:${zone_id}:row:${rowLabel}`;
            const keys = [rowKey, `event:${event_id}:show:${show_id}:user:${order.user_id}:held_count`];
            const args: string[] = [];

            seatsInRow.forEach(seat => {
                keys.push(`event:${event_id}:show:${show_id}:seat:${seat._id}:lock`);
                args.push(String(seat.col_index));
            });

            const newString = await redisClient.eval(releaseSeatsLuaScript, {
                keys,
                arguments: args,
            }) as string;
            if (newString) updatedRowStrings.push(newString);
        }

        const summaryKey = `event:${event_id}:show:${show_id}:zone:${zone_id}:summary`;
        const statusHashKey = `show:${show_id}:seat_status`;
        const holdingSetKey = `event:${event_id}:show:${show_id}:holding_seats`;
        const pipeline = redisClient.multi();

        for (const [tierName, releasedCount] of Object.entries(releaseByTier)) {
            pipeline.hIncrBy(summaryKey, `tier:${tierName}:count`, releasedCount);
        }

        if (updatedRowStrings.length > 0) {
            const validQuantities = calculateValidQuantities(updatedRowStrings);
            pipeline.hSet(summaryKey, 'valid_quantities', JSON.stringify(validQuantities));
        }
        pipeline.hDel(statusHashKey, seat_ids);
        if (seat_ids.length > 0) pipeline.sRem(holdingSetKey, seat_ids);
        await pipeline.exec();

        for (const seat_id of seat_ids) {
            await redisClient.publish('SEAT_UPDATES', JSON.stringify({
                show_id,
                seat_id,
                status: 'available'
            }));
        }

        const updatedHash = await redisClient.hGetAll(summaryKey);
        await redisClient.publish('ZONE_SUMMARY_UPDATES', JSON.stringify({
            zone_id,
            summary: formatHashToJSON(updatedHash)
        }));

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