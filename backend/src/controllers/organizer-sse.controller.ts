import { Request, Response } from 'express';
import { addAdminClient } from '../services/sse.service';
import Show from '../models/show.model';

export const streamAdminDashboard = async (req: Request, res: Response) => {
    try {
        const show_id = req.params.show_id as string;
        let event_id = req.params.event_id as string | undefined;

        if (!event_id && typeof req.query.event_id === 'string') {
            event_id = req.query.event_id;
        }

        if (!show_id) {
            res.status(400).json({ message: 'Thiếu mã định danh Đêm diễn (show_id).' });
            return;
        }

        if (!event_id) {
            const show = await Show.findById(show_id).select('event_id').lean();

            if (!show) {
                res.status(404).json({ message: 'Không tìm thấy đêm diễn.' });
                return;
            }

            event_id = String(show.event_id);
        }

        addAdminClient(res, show_id, event_id);
    } catch (error) {
        console.error('[Organizer SSE] Lỗi mở stream dashboard:', error);

        if (!res.headersSent) {
            res.status(500).json({ message: 'Không thể mở stream dashboard.' });
        }
    }
};
