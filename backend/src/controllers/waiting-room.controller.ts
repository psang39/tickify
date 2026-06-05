import { computeShowAvailability } from '../utils/showAvailability';
import { Request, Response } from 'express';
import { WaitingRoomService } from '../services/waiting-room.service';
import redisClient from '../utils/redisClient';
import jwt from 'jsonwebtoken';
import Event from '../models/event.model';
import Show from '../models/show.model';
import { JWT_SECRET } from '../config/index'
export const joinWaitingRoom = async (req: Request, res: Response) => {
    try {
        const show_id = req.params.show_id as string;
        const show = await Show.findById(show_id);
        const event = await Event.findById(show!.event_id);
        if (!show || !event) {
            res.status(404).json({ message: "Sự kiện hoặc buổi diễn không tồn tại" });
            return;
        }
        const availability = computeShowAvailability(show);
    if (!availability.is_bookable) {
      return res.status(403).json({ message: availability.booking_message, availability });
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
export const checkMyTurn = async (req: Request, res: Response) => {
    try {
        const show_id = req.params.show_id as string;
        const user_id = req.user!.id;
        const show = await Show.findById(show_id);
        const event = await Event.findById(show?.event_id);
        if (!show || !event) {
            return res.status(404).json({ message: "Sự kiện hoặc buổi diễn không tồn tại" });
        }
        const turnAvailability = computeShowAvailability(show);
    if (!turnAvailability.is_bookable) {
      await WaitingRoomService.leaveQueue(show_id, user_id);
      return res.status(403).json({ message: turnAvailability.booking_message, availability: turnAvailability });
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
                JWT_SECRET as string,
                { expiresIn: '15m' }

            );
            await redisClient.setEx(`event_id:${event._id}:show_id:${show_id}:user_id:${user_id}:checkoutToken:${checkoutToken}`, 15 * 60, "active");
            WaitingRoomService.leaveQueue(show_id, user_id);
            res.status(200).json({
                message: "Đã đến lượt của bạn!",
                status: 'YOUR_TURN',
                checkoutToken: checkoutToken
            });
        } else {
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