// File: src/controllers/waiting-room.controller.ts
import { Request, Response } from 'express';
import { WaitingRoomService } from '../services/waiting-room.service';
import redisClient from '../utils/redisClient';
import jwt from 'jsonwebtoken';
import Event from '../models/event.model';
import Show from '../models/show.model';
import { JWT_SECRET } from '../config/index'

// API 1: Bấm nút "Tham gia mua vé" -> Văng vào phòng chờ
export const joinWaitingRoom = async (req: Request, res: Response) => {
    try {
        // const event_id = req.params.event_id as string;
        const show_id = req.params.show_id as string;
        const show = await Show.findById(show_id);
        const event = await Event.findById(show!.event_id);

        if (!show || !event) {
            res.status(404).json({ message: "Sự kiện hoặc buổi diễn không tồn tại" });
            return;
        }

        const user = req.user;

        if (!user || !user.id) {
            return res.status(401).json({ error: "Bạn cần đăng nhập để thực hiện hành động này" });
        }

        const user_id = user.id;

        console.log(`User ${req.user!.id} đang cố gắng tham gia phòng chờ của show ${show_id} thuộc event ${event._id}`);

        const nowMs = Date.now();
        const startTimeStr = await redisClient.get(`event:${event._id}:show:${show_id}:sale_start`);
        if (!startTimeStr) {
            return res.status(404).json({ error: "Sự kiện không tồn tại hoặc chưa sẵn sàng." });
        }
        const saleStartTimeMs = parseInt(startTimeStr);
        if (nowMs < saleStartTimeMs) {
            return res.status(403).json({
                error: "Phòng chờ chưa mở cửa. Vui lòng quay lại sau!",
                // Trả về số mili-giây còn lại để Frontend hiển thị đồng hồ đếm ngược (nếu cần)
                time_remaining_ms: saleStartTimeMs - nowMs
            });
        }
        const position = await WaitingRoomService.joinQueue(show_id, user_id, saleStartTimeMs);

        res.status(200).json({
            message: "Đã tham gia phòng chờ",
            position: position
        });
    } catch (error) {
        console.error("Lỗi khi tham gia phòng chờ:", error);
        res.status(500).json({ message: "Lỗi hệ thống phòng chờ" });
    }
};

// API 2: Frontend gọi liên tục (Polling) mỗi 5-10 giây để check xem tới lượt chưa
export const checkMyTurn = async (req: Request, res: Response) => {
    try {
        // const event_id = req.params.event_id as string;
        const show_id = req.params.show_id as string;
        const user_id = req.user!.id;
        const show = await Show.findById(show_id);
        const event = await Event.findById(show?.event_id);

        if (!show || !event) {
            return res.status(404).json({ message: "Sự kiện hoặc buổi diễn không tồn tại" });
        }

        const result = await WaitingRoomService.checkStatus(show_id, user_id);

        if (result.status === 'YOUR_TURN') {
            const checkoutToken = jwt.sign(
                {
                    user_id: user_id,
                    event_id: event._id,
                    show_id: show_id,
                    purpose: 'checkout'
                },
                JWT_SECRET as string, // Hoặc dùng 1 secret riêng cho bảo mật cao hơn
                { expiresIn: '15m' } // Chỉ cho phép mua trong 15 phút, chần chừ là kick!
            );
            res.status(200).json({
                message: "Đã đến lượt của bạn!",
                status: 'YOUR_TURN',
                checkoutToken: checkoutToken
            });
        } else {
            // VẪN PHẢI ĐỢI
            res.status(200).json({
                message: "Vui lòng đợi...",
                status: 'WAITING',
                position: result.position,
                estimatedWaitTime: result.estimatedWaitTime
            });
        }
    } catch (error: any) {
        console.error("LỖI API CHECK STATUS:", error.message);
        res.status(400).json({ message: error.message });
    }
};