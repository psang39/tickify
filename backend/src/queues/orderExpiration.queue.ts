import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import mongoose from 'mongoose'; // Thêm mongoose để dùng Transaction
import Order from '../models/order.model';
import redisClient from '../utils/redisClient';
import { REDIS_URL } from '../config';
import { calculateValidQuantities } from '../utils/validQuantities';
import { formatHashToJSON } from '../utils/hashToJson';
import Seat from '../models/seat.model';

const connection = new IORedis(REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});

const releaseSeatsLuaScript = `
    local rowKey = KEYS[1]
    local userCountKey = KEYS[2] -- Thêm Key đếm vé của user
    
    -- Lấy chuỗi hiện tại
    local rowStr = redis.call('GET', rowKey)
    if not rowStr then return nil end

    -- Biến thành mảng để dễ sửa đổi
    local chars = {}
    for i = 1, #rowStr do
        chars[i] = rowStr:sub(i, i)
    end

    -- Đổi chữ 'H' thành 'O' ở ĐÚNG VỊ TRÍ col_index
    -- Độ dài của ARGV chính là số ghế cần nhả trong hàng này!
    local numSeatsToRelease = #ARGV
    for i = 1, numSeatsToRelease do
        local colIndex = tonumber(ARGV[i])
        local luaIndex = colIndex + 1
        if chars[luaIndex] == 'H' then
            chars[luaIndex] = 'O'
        end
    end

    local newRowStr = table.concat(chars)
    
    -- Ghi lại chuỗi mới
    redis.call('SET', rowKey, newRowStr)

    -- Xóa các Key khóa ghế (Lock)
    -- Chú ý: Bắt đầu vòng lặp từ 3 vì KEYS[1] là row, KEYS[2] là userCount
    for i = 3, #KEYS do
        redis.call('DEL', KEYS[i])
    end

    -- GIẢI PHÓNG VÉ CHO USER
    if numSeatsToRelease > 0 then
        local currentCount = tonumber(redis.call('GET', userCountKey) or 0)
        
        -- Logic bảo vệ (Self-healing): Chống trừ ra số âm lỡ có lỗi đồng bộ
        if currentCount >= numSeatsToRelease then
            redis.call('DECRBY', userCountKey, numSeatsToRelease)
        else
            redis.call('SET', userCountKey, 0)
        end
    end

    -- Trả về chuỗi mới để Node.js dùng tính toán valid_quantities
    return newRowStr
`;

// 1. Khởi tạo hàng đợi
export const orderExpirationQueue = new Queue('order-expiration', {
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

// 2. Định nghĩa Worker
const worker = new Worker('order-expiration', async (job: Job) => {
    const { order_id, event_id, zone_id, show_id, seat_ids } = job.data;
    console.log(`[BullMQ] Bắt đầu kiểm tra đơn hàng quá hạn: ${order_id}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const order = await Order.findById(order_id).session(session);

        if (order && order.status === 'pending') {
            order.status = 'cancelled';
            await order.save({ session });
            const seatsToRelease = await Seat.find({ _id: { $in: seat_ids } }).session(session);
            const seatsByRow: Record<string, typeof seatsToRelease> = {};
            const releaseByTier: Record<string, number> = {};

            seatsToRelease.forEach(seat => {
                if (!seatsByRow[seat.row]) seatsByRow[seat.row] = [];
                seatsByRow[seat.row].push(seat);
                releaseByTier[seat.tier] = (releaseByTier[seat.tier] || 0) + 1;
            });

            const updatedRowStrings: string[] = [];

            for (const rowLabel in seatsByRow) {
                const seatsInRow = seatsByRow[rowLabel];
                const rowKey = `show:${show_id}:zone:${zone_id}:row:${rowLabel}`;

                const keys = [rowKey, `show:${show_id}:user:${order.user_id}:held_count`];
                const args: string[] = [];

                seatsInRow.forEach(seat => {
                    keys.push(`event:${event_id}:show:${show_id}:seat:${seat._id}:lock`);
                    args.push(String(seat.col_index));
                });

                const newString = await redisClient.eval(releaseSeatsLuaScript, {
                    keys: keys,
                    arguments: args
                }) as string;

                if (newString) updatedRowStrings.push(newString);
            }


            const summaryKey = `show:${show_id}:zone:${zone_id}:summary`;
            const statusHashKey = `show:${show_id}:seat_status`;

            const pipeline = redisClient.multi();

            for (const [tierName, releasedCount] of Object.entries(releaseByTier)) {
                pipeline.hIncrBy(summaryKey, `tier:${tierName}:count`, releasedCount);
            }

            if (updatedRowStrings.length > 0) {
                const validQuantities = calculateValidQuantities(updatedRowStrings);
                pipeline.hSet(summaryKey, 'valid_quantities', JSON.stringify(validQuantities));
            }
            pipeline.hDel(statusHashKey, seat_ids);

            await pipeline.exec();

            for (const seat_id of seat_ids) {
                await redisClient.publish('SEAT_UPDATES', JSON.stringify({
                    show_id: show_id,
                    seat_id: seat_id,
                    status: 'available'
                }));
            }

            // Bắn SSE update toàn bộ Zone Summary
            const updatedHash = await redisClient.hGetAll(summaryKey);
            await redisClient.publish('ZONE_SUMMARY_UPDATES', JSON.stringify({
                zone_id: zone_id,
                summary: formatHashToJSON(updatedHash)
            }));

            await session.commitTransaction();
            console.log(`[BullMQ] Đã hủy đơn ${order_id}, nhả khóa và khôi phục chuỗi thành công.`);

        } else {
            console.log(`[BullMQ] Đơn ${order_id} đã được thanh toán hoặc xử lý trước đó. Bỏ qua.`);
            await session.abortTransaction();
        }
    } catch (error) {
        await session.abortTransaction();
        console.error(`[BullMQ] Lỗi xử lý đơn ${order_id}:`, error);
        throw error;
    } finally {
        session.endSession();
    }

}, { connection, concurrency: 5 });

worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} thất bại. Cần can thiệp tay! Lỗi:`, err);
});