import { Request, Response } from 'express';
import { WaitingRoomService } from '../services/waiting-room.service';
import redisClient from '../utils/redisClient';
import jwt from 'jsonwebtoken';
import Event from '../models/event.model';
import Show from '../models/show.model';
import { JWT_SECRET } from '../config/index';

const WAITING_ROOM_OPEN_BEFORE_MS = 30 * 60 * 1000;

const toTimeMs = (value: unknown): number | null => {
    if (!value) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    const raw = String(value).trim();
    if (!raw) return null;

    const numericValue = Number(raw);
    if (Number.isFinite(numericValue) && numericValue > 100000000000) {
        return numericValue;
    }

    const parsedDate = new Date(raw).getTime();
    return Number.isNaN(parsedDate) ? null : parsedDate;
};

const getShowSaleTimes = async (eventId: string, show: any) => {
    const showId = show._id.toString();
    const [saleStartRaw, saleEndRaw] = await Promise.all([
        redisClient.get(`event:${eventId}:show:${showId}:sale_start`),
        redisClient.get(`event:${eventId}:show:${showId}:sale_end`),
    ]);

    const saleStartMs = toTimeMs(saleStartRaw) ?? toTimeMs(show.sale_start);
    const saleEndMs = toTimeMs(saleEndRaw) ?? toTimeMs(show.sale_end);
    const showStartMs = toTimeMs(show.start_time);

    return {
        saleStartMs,
        saleEndMs,
        showStartMs,
        waitingRoomOpenMs: saleStartMs ? saleStartMs - WAITING_ROOM_OPEN_BEFORE_MS : null,
    };
};

const buildGateError = (message: string, statusCode = 403, extra: Record<string, unknown> = {}) => ({
    statusCode,
    payload: { error: message, message, ...extra },
});

const getCheckoutTokenKey = (eventId: string, showId: string, userId: string) => (
    `event:${eventId}:show:${showId}:user:${userId}:checkoutToken`
);

const createCheckoutToken = (eventId: string, showId: string, userId: string) => jwt.sign(
    {
        user_id: userId,
        event_id: eventId,
        show_id: showId,
        purpose: 'checkout',
    },
    JWT_SECRET as string,
    { expiresIn: '15m' }
);

const validateWaitingRoomGate = (show: any, times: Awaited<ReturnType<typeof getShowSaleTimes>>, nowMs: number) => {
    if (show.status !== 'published') {
        return buildGateError('Show diễn này chưa được công khai mở bán.');
    }

    if (!times.saleStartMs || !times.waitingRoomOpenMs) {
        return buildGateError('Show chưa có thời gian mở bán hợp lệ.');
    }

    if (times.showStartMs && nowMs >= times.showStartMs) {
        return buildGateError('Show diễn đang diễn ra hoặc đã kết thúc, hệ thống đã đóng đặt vé.');
    }

    if (times.saleEndMs && nowMs > times.saleEndMs) {
        return buildGateError('Thời gian mở bán vé đã kết thúc.');
    }

    if (nowMs < times.waitingRoomOpenMs) {
        return buildGateError('Phòng chờ chưa mở cửa. Vui lòng quay lại sau!', 403, {
            time_remaining_ms: times.waitingRoomOpenMs - nowMs,
            waiting_room_opens_at: new Date(times.waitingRoomOpenMs).toISOString(),
            sale_start_at: new Date(times.saleStartMs).toISOString(),
        });
    }

    return null;
};

export const joinWaitingRoom = async (req: Request, res: Response) => {
    try {
        const show_id = req.params.show_id as string;
        const show = await Show.findById(show_id);

        if (!show) {
            return res.status(404).json({ message: 'Sự kiện hoặc buổi diễn không tồn tại' });
        }

        const event = await Event.findById(show.event_id);
        if (!event) {
            return res.status(404).json({ message: 'Sự kiện hoặc buổi diễn không tồn tại' });
        }

        const user = req.user;
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện hành động này' });
        }

        const user_id = user.id;
        const nowMs = Date.now();
        const times = await getShowSaleTimes(event._id.toString(), show);
        const gateError = validateWaitingRoomGate(show, times, nowMs);
        if (gateError) {
            return res.status(gateError.statusCode).json(gateError.payload);
        }

        const saleStartTimeMs = times.saleStartMs!;
        const result = await WaitingRoomService.joinWaitingRoom(show_id, user_id, saleStartTimeMs);

        res.status(200).json({
            message: result.status === 'WAITING_ROOM'
                ? 'Đã vào phòng chờ. Số thứ tự sẽ được random khi bắt đầu mở bán.'
                : 'Đã tham gia hàng đợi đặt vé.',
            status: result.status,
            position: result.position,
            sale_started: result.saleStarted,
            sale_start_in_ms: Math.max(0, saleStartTimeMs - nowMs),
            sale_start_at: new Date(saleStartTimeMs).toISOString(),
        });
    } catch (error) {
        console.error('Lỗi khi tham gia phòng chờ:', error);
        res.status(500).json({ message: 'Lỗi hệ thống phòng chờ' });
    }
};

export const checkMyTurn = async (req: Request, res: Response) => {
    try {
        const show_id = req.params.show_id as string;
        const user_id = req.user!.id;
        const show = await Show.findById(show_id);

        if (!show) {
            return res.status(404).json({ message: 'Sự kiện hoặc buổi diễn không tồn tại' });
        }

        const event = await Event.findById(show.event_id);
        if (!event) {
            return res.status(404).json({ message: 'Sự kiện hoặc buổi diễn không tồn tại' });
        }

        const nowMs = Date.now();
        const times = await getShowSaleTimes(event._id.toString(), show);
        const gateError = validateWaitingRoomGate(show, times, nowMs);
        if (gateError) {
            await WaitingRoomService.leaveQueue(show_id, user_id);
            return res.status(gateError.statusCode).json(gateError.payload);
        }

        const eventId = event._id.toString();
        const checkoutTokenKey = getCheckoutTokenKey(eventId, show_id, user_id);
        const hasActiveCheckoutToken = await redisClient.get(checkoutTokenKey);

        // Idempotency: sau khi đã tới lượt, frontend có thể gọi /status thêm 1 lần
        // trong lúc đang redirect. Không báo lỗi "không có mặt trong hàng đợi" nữa.
        if (hasActiveCheckoutToken) {
            return res.status(200).json({
                message: 'Đã đến lượt của bạn!',
                status: 'YOUR_TURN',
                checkoutToken: createCheckoutToken(eventId, show_id, user_id),
            });
        }

        const result = await WaitingRoomService.checkStatus(show_id, user_id, times.saleStartMs!);

        if (result.status === 'YOUR_TURN') {
            const checkoutToken = createCheckoutToken(eventId, show_id, user_id);

            await redisClient.setEx(
                checkoutTokenKey,
                15 * 60,
                'active'
            );

            await WaitingRoomService.leaveQueue(show_id, user_id);
            return res.status(200).json({
                message: 'Đã đến lượt của bạn!',
                status: 'YOUR_TURN',
                checkoutToken,
            });
        }

        res.status(200).json({
            message: result.status === 'WAITING_ROOM'
                ? 'Bạn đang ở trong phòng chờ. Khi mở bán, hệ thống sẽ random số thứ tự và chuyển bạn sang hàng đợi.'
                : 'Vui lòng đợi...',
            status: result.status,
            position: result.position,
            estimatedWaitTime: result.estimatedWaitTime,
            sale_start_in_ms: Math.max(0, times.saleStartMs! - nowMs),
            sale_start_at: new Date(times.saleStartMs!).toISOString(),
        });
    } catch (error: any) {
        console.error('LỖI API CHECK STATUS:', error.message);
        res.status(400).json({ message: error.message });
    }
};
