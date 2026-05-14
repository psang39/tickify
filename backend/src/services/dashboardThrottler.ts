// file: src/services/dashboardThrottler.ts
import redisClient from '../utils/redisClient';

let activeThrottlers = new Set<string>();

export const startAdminDashboardThrottler = (show_id: string) => {
    // Tránh chạy trùng lặp Throttler cho cùng 1 show
    if (activeThrottlers.has(show_id)) return;
    activeThrottlers.add(show_id);

    const holdingSetKey = `show:${show_id}:holding_seats`;
    const soldCountKey = `show:${show_id}:sold_count`;
    const revenueKey = `show:${show_id}:total_revenue`;
    const ADMIN_CHANNEL = `SHOW_${show_id}_ADMIN_DASHBOARD`;

    const intervalId = setInterval(async () => {
        try {
            const pipeline = redisClient.multi();

            // Lấy cả 3 chỉ số cùng một lúc
            pipeline.sCard(holdingSetKey);
            pipeline.get(soldCountKey);
            pipeline.get(revenueKey);

            const results = await pipeline.exec();

            if (results) {
                // Parse kết quả từ Pipeline (cấu trúc trả về là [error, result])
                const holdingCount = Number(results[0] as unknown) || 0;
                const soldCount = Number(results[1] as unknown) || 0;
                const totalRevenue = Number(results[2] as unknown) || 0;

                const dashboardData = {
                    timestamp: new Date().toISOString(),
                    holdingCount,
                    soldCount,
                    totalRevenue
                };

                await redisClient.publish(ADMIN_CHANNEL, JSON.stringify(dashboardData));
            }
        } catch (error) {
            console.error(`[Dashboard Throttler] Lỗi sync show ${show_id}:`, error);
        }
    }, 2000);
};