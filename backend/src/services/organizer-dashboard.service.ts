import redisClient from '../utils/redisClient';
import Show from '../models/show.model';

export const publishOrganizerDashboardUpdate = async (showId: string) => {
    const show = await Show.findById(showId).select('_id event_id').lean();
    if (!show) return;

    const eventId = show.event_id.toString();
    const revenueKey = `event:${eventId}:show:${showId}:total_revenue`;
    const soldCountKey = `event:${eventId}:show:${showId}:sold_count`;

    const [totalRevenue, soldCount] = await Promise.all([
        redisClient.get(revenueKey),
        redisClient.get(soldCountKey)
    ]);

    await redisClient.publish('ORGANIZER_DASHBOARD_UPDATES', JSON.stringify({
        show_id: showId,
        event_id: eventId,
        total_revenue: Number(totalRevenue || 0),
        sold_count: Number(soldCount || 0),
        updated_at: new Date().toISOString()
    }));
};
