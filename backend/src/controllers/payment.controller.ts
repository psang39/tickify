// file: src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import Order from '../models/order.model';
import crypto from 'crypto';
import { MOCK_PAYMENT_SECRET, FRONTEND_URL, BACKEND_URL, PORT } from '../config/index';
import axios from 'axios';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export const createPaymentUrl = async (req: Request, res: Response): Promise<void> => {
    try {
        const user_id = req.user?.id;
        const { orderId, purchaserName, purchaserPhone, purchaserEmail, paymentMethod } = req.body;
        const order = await Order.findOne({ _id: orderId, user_id: user_id });

        if (!order) {
            res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
            return;
        }

        if (order.status !== 'pending') {
            res.status(400).json({ message: 'Đơn hàng này không ở trạng thái chờ thanh toán.' });
            return;
        }

        if (new Date() > new Date(order.cancellation_deadline)) {
            res.status(400).json({ message: 'Đơn hàng đã hết thời gian giữ chỗ (10 phút).' });
            return;
        }

        order.purchaser_name = purchaserName;
        order.purchaser_phone = purchaserPhone;
        order.purchaser_email = purchaserEmail;
        await order.save();

        let paymentUrl = '';

        if (paymentMethod === 'VNPAY') {
        } else if (paymentMethod === 'MOCK') {

            const frontendBaseUrl = FRONTEND_URL || 'http://localhost:5173';
            paymentUrl = `${frontendBaseUrl}/mock-gateway?orderId=${order._id}&amount=${order.total_price}`;

        } else {
            res.status(400).json({ message: 'Phương thức thanh toán không hợp lệ.' });
            return;
        }

        res.status(200).json({
            message: 'Tạo URL thanh toán thành công.',
            data: {
                paymentUrl: paymentUrl
            }
        });

    } catch (error) {
        console.error('[PaymentController] Lỗi createPaymentUrl:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi khởi tạo thanh toán.' });
    }
};

const postMockIpnWithRetry = async (payload: any) => {
    const maxAttemptsPerUrl = 3;
    const url = `${BACKEND_URL}/api/v1/webhooks/payment-result`;
    for (let attempt = 1; attempt <= maxAttemptsPerUrl; attempt++) {
        try {
            await axios.post(url, payload, { timeout: 5000 });
            console.log(`[Mock Gateway] Đã bắn IPN thành công cho đơn hàng: ${payload.order_id} -> ${url}`);
            return;
        } catch (err: any) {
            const statusCode = err.response?.status;
            const message = err.response?.data?.message || err.message;
            console.error(
                `[Mock Gateway] IPN thất bại cho ${payload.order_id} ` +
                `${BACKEND_URL}/api/v1/webhooks/mock-gateway, attempt=${attempt}/${maxAttemptsPerUrl}, status=${statusCode || 'NO_RESPONSE'}): ${message}`
            );

            if (statusCode === 404) break;

            if (attempt < maxAttemptsPerUrl) {
                await sleep(500 * attempt);
            }
        }
    }


    console.error(`[Mock Gateway] Không thể bắn IPN sau khi thử tất cả URL cho đơn hàng: ${payload.order_id}`);
};

export const generateMockReturnUrl = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId, amount, status } = req.body;

        const secret = process.env.MOCK_PAYMENT_SECRET;
        if (!secret) {
            res.status(500).json({ message: 'Chưa cấu hình MOCK_PAYMENT_SECRET trên server.' });
            return;
        }

        const order = await Order.findById(orderId);
        if (!order) {
            res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
            return;
        }

        const transactionId = `MOCK_${Date.now()}`;

        const payloadToReturn = `orderId=${orderId}&amount=${amount}&status=${status}`;
        const signatureReturn = crypto.createHmac('sha256', secret).update(payloadToReturn).digest('hex');

        const payloadToWebhook = `order_id=${orderId}&amount=${amount}&status=${status}&transactionId=${transactionId}`;
        const signatureWebhook = crypto.createHmac('sha256', secret).update(payloadToWebhook).digest('hex');

        const ipnPayload = {
            order_id: orderId,
            amount,
            status,
            transaction_id: transactionId,
            signature: signatureWebhook
        };

        // Fire-and-forget, nhưng có retry bên trong. Return URL không bị chặn bởi IPN.
        void postMockIpnWithRetry(ipnPayload);

        const frontendBaseUrl = FRONTEND_URL || 'http://localhost:5173';
        const returnUrl = `${frontendBaseUrl}/payment/result?orderId=${orderId}&amount=${amount}&status=${status}&signature=${signatureReturn}`;

        res.status(200).json({
            message: 'Tạo Return URL và kích hoạt IPN ngầm thành công.',
            data: { returnUrl }
        });
    } catch (error) {
        console.error('[PaymentController] Lỗi generateMockReturnUrl:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi tạo URL trả về.' });
    }
};
export const getPaymentResult = async (req: Request, res: Response): Promise<void> => {
    try {
        const { order_id } = req.params;

        const order = await Order.findById(order_id).select(
            '_id show_id event_id status purchaser_name purchaser_phone purchaser_email total_price cancellation_deadline'
        );

        if (!order) {
            res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
            return;
        }

        res.status(200).json({
            message: 'Lấy kết quả thanh toán thành công',
            data: {
                orderId: order._id,
                showId: order.show_id,
                eventId: order.event_id,
                status: order.status,
                email: order.purchaser_email,
                purchaserName: order.purchaser_name,
                purchaserPhone: order.purchaser_phone,
                purchaserEmail: order.purchaser_email,
                totalPrice: order.total_price,
                cancellationDeadline: order.cancellation_deadline,
                canRetry: order.status === 'pending' && new Date() <= new Date(order.cancellation_deadline)
            }
        });
    } catch (error) {
        console.error('Lỗi getPaymentResult:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy kết quả thanh toán' });
    }
};
