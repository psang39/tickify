import { Request, Response } from 'express';
import crypto from 'crypto';
import Order from '../models/order.model';
import Payment from '../models/payment.model';
import Seat from '../models/seat.model';
import redisClient from '../utils/redisClient';
import { generateTicketsForOrder } from '../services/ticket.service';
import { MOCK_PAYMENT_SECRET } from '../config/index';
import { publishOrganizerDashboardUpdate } from '../services/organizer-dashboard.service';

export const handleMockPaymentWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const { order_id, amount, status, transaction_id, signature } = req.body;
        console.log(`[WEBHOOK] Nhận tín hiệu thanh toán cho Order: ${order_id}`);

        const rawData = `order_id=${order_id}&amount=${amount}&status=${status}&transactionId=${transaction_id}`;
        const expectedSignature = crypto
            .createHmac('sha256', MOCK_PAYMENT_SECRET as string)
            .update(rawData)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error('[WEBHOOK] Chữ ký không hợp lệ!');
            res.status(400).json({ message: 'Invalid signature' });
            return;
        }

        const order = await Order.findById(order_id);
        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        if (status !== 'SUCCESS') {
            await Order.findByIdAndUpdate(order_id, { status: 'cancelled' });
            res.status(200).json({ message: 'OK' });
            return;
        }

        if (order.status === 'confirmed') {
            res.status(200).json({ message: 'OK' });
            return;
        }

        if (order.status !== 'pending') {
            res.status(409).json({ message: `Order is not pending. Current status: ${order.status}` });
            return;
        }

        const eventId = order.event_id.toString();
        const showId = order.show_id.toString();
        const userId = order.user_id.toString();
        const seatIds = order.items.map((item: any) => item.seat_id.toString());
        const ticketCount = seatIds.length;
        const revenueKey = `event:${eventId}:show:${showId}:total_revenue`;
        const soldCountKey = `event:${eventId}:show:${showId}:sold_count`;
        const statusHashKey = `show:${showId}:seat_status`;
        const holdingSetKey = `event:${eventId}:show:${showId}:holding_seats`;
        const heldCountKey = `event:${eventId}:show:${showId}:user:${userId}:held_count`;

        order.status = 'confirmed';

        const payment = new Payment({
            order_id: order._id,
            amount: Number(amount),
            payment_method: 'mock',
            status: 'confirmed',
            transaction_id,
            processed_at: new Date(),
            billing_info: {
                billing_name: order.purchaser_name || null,
                billing_email: order.purchaser_email || null,
                billing_phone: order.purchaser_phone || null
            }
        });

        await payment.save();
        await order.save();

        await Seat.updateMany(
            { _id: { $in: seatIds } },
            { $set: { status: 'sold' } }
        );

        const pipeline = redisClient.multi();
        for (const seatId of seatIds) {
            pipeline.hSet(statusHashKey, seatId, 'sold');
            pipeline.sRem(holdingSetKey, seatId);
            pipeline.del(`event:${eventId}:show:${showId}:seat:${seatId}:lock`);
        }

        pipeline.decrBy(heldCountKey, ticketCount);
        pipeline.incrBy(revenueKey, Number(payment.amount));
        pipeline.incrBy(soldCountKey, ticketCount);

        const checkoutToken = await redisClient.get(`event:${eventId}:show:${showId}:user:${userId}:checkoutToken`);
        if (checkoutToken) {
            pipeline.del(`event:${eventId}:show:${showId}:checkoutToken:${checkoutToken}`);
        }
        pipeline.del(`event:${eventId}:show:${showId}:user:${userId}:checkoutToken`);

        await pipeline.exec();

        for (const seatId of seatIds) {
            await redisClient.publish('SEAT_UPDATES', JSON.stringify({
                show_id: showId,
                seat_id: seatId,
                status: 'sold'
            }));
        }

        await publishOrganizerDashboardUpdate(showId);

        console.log(`[WEBHOOK] Bắt đầu tạo vé cho Order: ${order_id}`);
        await generateTicketsForOrder(order._id.toString());
        console.log(`[WEBHOOK] Xử lý hoàn tất Order: ${order_id}`);

        res.status(200).json({ message: 'OK' });
    } catch (error) {
        console.error('[WEBHOOK] Lỗi hệ thống:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
