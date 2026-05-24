
import { Request, Response } from 'express';
import { addAdminClient } from '../services/sse.service';
import { createClient } from 'redis';
import { startAdminDashboardThrottler } from '../services/dashboardThrottler';
import { REDIS_URL } from '../config/index';

export const streamAdminDashboard = async (req: Request, res: Response) => {
    const show_id = req.params.show_id as string;

    if (!show_id) {
        res.status(400).json({ message: "Thiếu mã định danh Đêm diễn (show_id)" });
        return;
    }
    addAdminClient(res, show_id);
};