import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/order.model';
import Payment from '../models/payment.model';
import Seat from '../models/seat.model';
import redisClient from '../utils/redisClient';
import { generateTicketsForOrder } from '../services/ticket.service';
import { MOCK_PAYMENT_SECRET } from '../config/index';
import { publishOrganizerDashboardUpdate } from '../services/organizer-dashboard.service';
import { getReservationState } from '../domain/reservation';
import { assertOrderTransition, type OrderStatus } from '../domain/order-transition';

type PaymentTransactionResult =
    | { kind: 'processed'; order: any }
    | { kind: 'already-processed' }
    | { kind: 'not-found' }
    | { kind: 'expired' }
    | { kind: 'conflict'; status: string };

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

        const initialOrder = await Order.findById(order_id);
        if (!initialOrder) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        if (status !== 'SUCCESS') {
            if (getReservationState(initialOrder as any) === 'expired') {
                assertOrderTransition(initialOrder.status as OrderStatus, 'cancelled');
                initialOrder.status = 'cancelled';
                await initialOrder.save();
            }

            res.status(200).json({
                message: 'Payment failed, order is still retryable if not expired',
                canRetry: initialOrder.status === 'pending'
            });
            return;
        }

        const session = await mongoose.startSession();
        let transactionResult: PaymentTransactionResult | undefined;

        try {
            await session.withTransaction(async () => {
                transactionResult = undefined;
                const order = await Order.findById(order_id).session(session);

                if (!order) {
                    transactionResult = { kind: 'not-found' };
                    return;
                }

                if (order.status === 'confirmed') {
                    transactionResult = { kind: 'already-processed' };
                    return;
                }

                if (order.status !== 'pending') {
                    transactionResult = { kind: 'conflict', status: order.status };
                    return;
                }

                if (getReservationState(order as any) === 'expired') {
                    assertOrderTransition(order.status as OrderStatus, 'cancelled');
                    order.status = 'cancelled';
                    await order.save({ session });
                    transactionResult = { kind: 'expired' };
                    return;
                }

                assertOrderTransition(order.status as OrderStatus, 'confirmed');
                order.status = 'confirmed';
                await order.save({ session });

                await Payment.updateOne(
                    { order_id: order._id },
                    {
                        $setOnInsert: {
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
                        }
                    },
                    { upsert: true, session },
                );

                const seatIds = order.items.map((item: any) => item.seat_id.toString());
                await Seat.updateMany(
                    { _id: { $in: seatIds } },
                    { $set: { status: 'sold' } },
                    { session },
                );

                await generateTicketsForOrder(order._id.toString(), session);
                transactionResult = { kind: 'processed', order };
            });
        } finally {
            await session.endSession();
        }

        const result = transactionResult as PaymentTransactionResult | undefined;
        if (!result) throw new Error('Payment transaction finished without a result');

        if (result.kind === 'not-found') {
            res.status(404).json({ message: 'Order not found' });
            return;
        }
        if (result.kind === 'already-processed') {
            res.status(200).json({ message: 'OK' });
            return;
        }
        if (result.kind === 'expired') {
            res.status(409).json({ message: 'Order expired' });
            return;
        }
        if (result.kind === 'conflict') {
            res.status(409).json({ message: `Order is not pending. Current status: ${result.status}` });
            return;
        }

        const order = result.order;
        const eventId = order.event_id.toString();
        const showId = order.show_id.toString();
        const userId = order.user_id.toString();
        const seatIds = order.items.map((item: any) => item.seat_id.toString());
        const ticketCount = seatIds.length;
        const paymentAmount = Number(amount);
        const revenueKey = `event:${eventId}:show:${showId}:total_revenue`;
        const soldCountKey = `event:${eventId}:show:${showId}:sold_count`;
        const statusHashKey = `show:${showId}:seat_status`;
        const holdingSetKey = `event:${eventId}:show:${showId}:holding_seats`;
        const heldCountKey = `event:${eventId}:show:${showId}:user:${userId}:held_count`;

        const seatsToConfirm = await Seat.find({ _id: { $in: seatIds } })
            .select('_id row col_index zone_id ticket_type_id')
            .lean();

        const pipeline = redisClient.multi();
        const seatsByZoneRow: Record<string, any[]> = {};
        for (const seat of seatsToConfirm as any[]) {
            const key = `${seat.zone_id.toString()}::${seat.row}`;
            if (!seatsByZoneRow[key]) seatsByZoneRow[key] = [];
            seatsByZoneRow[key].push(seat);
        }

        for (const [zoneRowKey, rowSeats] of Object.entries(seatsByZoneRow)) {
            const [zoneId, rowLabel] = zoneRowKey.split('::');
            const rowKey = `event:${eventId}:show:${showId}:zone:${zoneId}:row:${rowLabel}`;
            const rowStr = await redisClient.get(rowKey);
            if (rowStr) {
                const chars = rowStr.split('');
                for (const seat of rowSeats as any[]) {
                    const index = Number(seat.col_index) - 1;
                    if (index >= 0 && index < chars.length) chars[index] = 'S';
                }
                pipeline.set(rowKey, chars.join(''));
            }
        }

        for (const seatId of seatIds) {
            pipeline.hSet(statusHashKey, seatId, 'sold');
            pipeline.sRem(holdingSetKey, seatId);
            pipeline.del(`event:${eventId}:show:${showId}:seat:${seatId}:lock`);
        }

        pipeline.decrBy(heldCountKey, ticketCount);
        pipeline.incrBy(revenueKey, paymentAmount);
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
        console.log(`[WEBHOOK] Xử lý hoàn tất Order: ${order_id}`);
        res.status(200).json({ message: 'OK' });
    } catch (error) {
        console.error('[WEBHOOK] Lỗi hệ thống:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
