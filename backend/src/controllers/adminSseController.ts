// file: src/controllers/adminSseController.ts
import { Request, Response } from 'express';
import { createClient } from 'redis';
import { startAdminDashboardThrottler } from '../services/dashboardThrottler';

export const streamAdminDashboard = async (req: Request, res: Response) => {
    const show_id = req.params.show_id as string;

    // Kích hoạt bộ đếm ngầm (chỉ khởi chạy 1 lần)
    startAdminDashboardThrottler(show_id);

    // Setup HTTP Header cho SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Tạo Subscriber riêng cho kết nối SSE này
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