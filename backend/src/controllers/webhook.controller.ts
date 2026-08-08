import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/order.model';
import Payment from '../models/payment.model';
import Seat from '../models/seat.model';
import OutboxEvent from '../models/outbox-event.model';
import { generateTicketsForOrder } from '../services/ticket.service';
import { MOCK_PAYMENT_SECRET } from '../config/index';
import { getReservationState } from '../domain/reservation';
import {
    assertOrderTransition,
    type OrderStatus,
} from '../domain/order-transition';
import { createPaymentConfirmedEvent } from '../kafka/payment-events';

type PaymentTransactionResult =
    | { kind: 'processed' }
    | { kind: 'already-processed' }
    | { kind: 'not-found' }
    | { kind: 'expired' }
    | { kind: 'conflict'; status: string };

export const handleMockPaymentWebhook = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const {
            order_id,
            amount,
            status,
            transaction_id,
            signature,
        } = req.body;

        console.log(
            `[WEBHOOK] Nhận tín hiệu thanh toán cho Order: ${order_id}`,
        );

        const rawData =
            `order_id=${order_id}&amount=${amount}&status=${status}` +
            `&transactionId=${transaction_id}`;

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
                assertOrderTransition(
                    initialOrder.status as OrderStatus,
                    'cancelled',
                );
                initialOrder.status = 'cancelled';
                await initialOrder.save();
            }

            res.status(200).json({
                message:
                    'Payment failed, order is still retryable if not expired',
                canRetry: initialOrder.status === 'pending',
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
                    transactionResult = {
                        kind: 'conflict',
                        status: order.status,
                    };
                    return;
                }

                if (getReservationState(order as any) === 'expired') {
                    assertOrderTransition(
                        order.status as OrderStatus,
                        'cancelled',
                    );
                    order.status = 'cancelled';
                    await order.save({ session });
                    transactionResult = { kind: 'expired' };
                    return;
                }

                assertOrderTransition(
                    order.status as OrderStatus,
                    'confirmed',
                );

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
                                billing_name:
                                    order.purchaser_name || null,
                                billing_email:
                                    order.purchaser_email || null,
                                billing_phone:
                                    order.purchaser_phone || null,
                            },
                        },
                    },
                    {
                        upsert: true,
                        session,
                    },
                );

                const seatIds = order.items.map(
                    (item: any) => item.seat_id.toString(),
                );

                await Seat.updateMany(
                    { _id: { $in: seatIds } },
                    { $set: { status: 'sold' } },
                    { session },
                );

                await generateTicketsForOrder(
                    order._id.toString(),
                    session,
                );

                const paymentEvent = createPaymentConfirmedEvent({
                    orderId: order._id.toString(),
                    transactionId: String(transaction_id),
                    eventId: order.event_id.toString(),
                    showId: order.show_id.toString(),
                    userId: order.user_id.toString(),
                    seatIds,
                    amount: Number(amount),
                });

                await OutboxEvent.create(
                    [
                        {
                            event_id: paymentEvent.eventId,
                            aggregate_id: paymentEvent.data.orderId,
                            event_type: paymentEvent.type,
                            payload: paymentEvent as unknown as Record<string, unknown>,
                            status: 'pending',
                            attempts: 0,
                            next_attempt_at: new Date(),
                        },
                    ],
                    { session },
                );

                transactionResult = { kind: 'processed' };
            });
        } finally {
            await session.endSession();
        }

        const result =
            transactionResult as PaymentTransactionResult | undefined;

        if (!result) {
            throw new Error(
                'Payment transaction finished without a result',
            );
        }

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
            res.status(409).json({
                message:
                    `Order is not pending. Current status: ${result.status}`,
            });
            return;
        }
        console.log(
            `[WEBHOOK] Payment committed and queued for Kafka: ${order_id}`,
        );

        res.status(200).json({ message: 'OK' });
    } catch (error) {
        console.error('[WEBHOOK] Lỗi hệ thống:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
