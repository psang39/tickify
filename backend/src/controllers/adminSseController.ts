
import { Request, Response } from 'express';
import { createClient } from 'redis';
import { startAdminDashboardThrottler } from '../services/dashboardThrottler';

export const streamAdminDashboard = async (req: Request, res: Response) => {
    const show_id = req.params.show_id as string;


    startAdminDashboardThrottler(show_id);


    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();


    const subscriber = createClient({ url: process.env.REDIS_URL });
    await subscriber.connect();

    const ADMIN_CHANNEL = `SHOW_${show_id}_ADMIN_DASHBOARD`;

    subscriber.subscribe(ADMIN_CHANNEL, (message) => {
        res.write(`data: ${message}\n\n`);
    });

    req.on('close', async () => {
        await subscriber.unsubscribe(ADMIN_CHANNEL);
        await subscriber.disconnect();
    });
};