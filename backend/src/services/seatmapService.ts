import Seat from '../models/seat.model';
import redisClient from '../utils/redisClient';
export const warmUpSeatmapCache = async (show_id: string) => {
    const cacheKey = `show:${show_id}:layout_static`;
    const seats = await Seat.find({ show_id })
        .select('seat_number zone_id row col_index tier')
        .sort({ row: 1, col_index: 1 })
        .lean();
    if (!seats || seats.length === 0) {
        throw new Error("Không có dữ liệu ghế để nạp vào cache.");
    }
    const seatsData = JSON.stringify(seats);
    await redisClient.set(cacheKey, seatsData, {
        EX: 604800
    });
    console.log(`[Cache Warming] Đã nạp ${seats.length} ghế của show ${show_id} vào Redis.`);
    return seats.length;
};