import redisClient from '../utils/redisClient';
let activeThrottlers = new Set<string>();
export const startAdminDashboardThrottler = (event_id: string, show_id: string) => {
    if (activeThrottlers.has(show_id)) return;
    activeThrottlers.add(show_id);
    const holdingSetKey = `event:${event_id}:show:${show_id}:holding_seats`;
    const soldCountKey = `event:${event_id}:show:${show_id}:sold_count`;
    const revenueKey = `event:${event_id}:show:${show_id}:total_revenue`;
    const ADMIN_CHANNEL = `SHOW_${show_id}_ADMIN_DASHBOARD`;
    const intervalId = setInterval(async () => {
        try {
            const pipeline = redisClient.multi();
            pipeline.sCard(holdingSetKey);
            pipeline.get(soldCountKey);
            pipeline.get(revenueKey);
            const results = await pipeline.exec();
            if (results) {
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