// src/services/seatmapService.ts
import Seat from '../models/seat.model';
import redisClient from '../utils/redisClient';

export const warmUpSeatmapCache = async (show_id: string) => {
    const cacheKey = `show:${show_id}:layout_static`;

    const seats = await Seat.find({ show_id })
        .select('seat_number zone_id row col_index tier')
        .sort({ row: 1, col_index: 1 }) // Sắp xếp sẵn để Frontend render mượt hơn
        .lean();

    if (!seats || seats.length === 0) {
        throw new Error("Không có dữ liệu ghế để nạp vào cache.");
    }

    // 2. Chuyển thành JSON string
    const seatsData = JSON.stringify(seats);

    // 3. Nạp vào Redis
    // Với dữ liệu quan trọng như Layout, bạn nên để thời gian EX (Expire) dài (ví dụ 7 ngày)
    // hoặc thậm chí không để Expire nếu bạn có cơ chế xóa thủ công.
    await redisClient.set(cacheKey, seatsData, {
        EX: 604800 // 7 ngày
    });

    console.log(`[Cache Warming] Đã nạp ${seats.length} ghế của show ${show_id} vào Redis.`);
    return seats.length;
};