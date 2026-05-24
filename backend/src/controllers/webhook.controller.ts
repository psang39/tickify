import { Request, Response } from 'express';
import crypto from 'crypto';
import Order from '../models/order.model';
import Payment from '../models/payment.model';
import Seat from '../models/seat.model';
import redisClient from '../utils/redisClient';
import { generateTicketsForOrder } from '../services/ticket.service';
import { MOCK_PAYMENT_SECRET } from '../config/index';
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
            console.error(`[WEBHOOK] Chữ ký không hợp lệ!`);
            res.status(400).json({ message: "Invalid signature" });
            return;
        }
        if (status === 'SUCCESS') {
            const order = await Order.findById(order_id);
            if (!order) {
                res.status(404).json({ message: "Order not found" });
                return;
            }
            if (order.status === 'confirmed') {
                res.status(200).json({ message: "OK" });
                return;
            }
            const revenueKey = `event:${order.event_id}:show:${order.show_id}:total_revenue`;
            const soldCountKey = `event:${order.event_id}:show:${order.show_id}:sold_count`;
            const ticket_count = order.items.length;
            order.status = 'confirmed';
            const payment = new Payment({
                order_id: order._id,
                amount: amount,
                payment_method: 'mock',
                status: 'confirmed',
                transaction_id: transaction_id,
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
                { _id: { $in: order.items.map((item: any) => item.seat_id) } },
                { $set: { status: 'sold' } }
            );
            for (const seat_id of order.items.map((item: any) => item.seat_id)) {
                await redisClient.del(`event:${order.event_id}:show:${order.show_id}:seat:${seat_id}:lock`);
            }
            await redisClient.DECRBY(`event:${order.event_id}:show:${order.show_id}:user:${order.user_id}:held_count`, order.items.length);
            const checkoutToken = await redisClient.get(
                `event:${order.event_id}:show:${order.show_id}:user:${order.user_id}:checkoutToken`
            );
            if (checkoutToken) {
                await redisClient.del(
                    `event:${order.event_id}:show:${order.show_id}:checkoutToken:${checkoutToken}`
                );
            }
            await redisClient.del(
                `event:${order.event_id}:show:${order.show_id}:user:${order.user_id}:checkoutToken`
            );
            await redisClient.incrby(revenueKey, payment.amount);
            await redisClient.incrby(soldCountKey, ticket_count);
            console.log(`[WEBHOOK] Bắt đầu đẻ vé cho Order: ${order_id}`);
            await generateTicketsForOrder(order._id.toString());
            console.log(`[WEBHOOK] Xử lý hoàn tất Order: ${order_id}`);
        } else {
            await Order.findByIdAndUpdate(order_id, { status: 'CANCELLED' });
        }
        res.status(200).json({ message: "OK" });
    } catch (error) {
        console.error('[WEBHOOK] Lỗi hệ thống:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};