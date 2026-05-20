// file: src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import Order from '../models/order.model';
import crypto from 'crypto';
import { MOCK_PAYMENT_SECRET } from '../config/index';
import axios from 'axios';

export const createPaymentUrl = async (req: Request, res: Response): Promise<void> => {
    try {
        const user_id = req.user?.id;
        const { orderId, purchaserName, purchaserPhone, purchaserEmail, paymentMethod } = req.body;

        // 1. TÌM VÀ KIỂM TRA ĐƠN HÀNG
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

            const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
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

export const generateMockReturnUrl = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orderId, amount, status } = req.body; 
        
        const secret = process.env.MOCK_PAYMENT_SECRET;
        if (!secret) {
            res.status(500).json({ message: 'Chưa cấu hình MOCK_PAYMENT_SECRET trên server.' });
            return;
        }

        const transactionId = `MOCK_${Date.now()}`;

        const payloadToReturn = `orderId=${orderId}&amount=${amount}&status=${status}`;
        const signatureReturn = crypto.createHmac('sha256', secret).update(payloadToReturn).digest('hex');
        const payloadToWebhook = `order_id=${orderId}&amount=${amount}&status=${status}&transactionId=${transactionId}`;
        const signatureWebhook = crypto.createHmac('sha256', secret).update(payloadToWebhook).digest('hex');
        const backendBaseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
        
        // Nhớ sửa '/webhooks/payment-result' cho khớp với route thực tế trên server của bạn
        axios.post(`${backendBaseUrl}/webhooks/payment-result`, {
            order_id: orderId,
            amount: amount,
            status: status,
            transaction_id: transactionId,
            signature: signatureWebhook
        }).then(() => {
            console.log(`✅ [Mock Gateway] Đã bắn IPN thành công cho đơn hàng: ${orderId}`);
        }).catch((err) => {
            console.error(`❌ [Mock Gateway] Lỗi khi bắn IPN ngầm cho ${orderId}:`, err.message);
        });

        // 5. TRẢ RETURN URL VỀ CHO FRONTEND
        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const returnUrl = `${frontendBaseUrl}/payment/result?orderId=${orderId}&amount=${amount}&status=${status}&signature=${signatureReturn}`;

        res.status(200).json({
            message: 'Tạo Return URL và kích hoạt Webhook ngầm thành công',
            data: { returnUrl }
        });

    } catch (error) {
        console.error('[PaymentController] Lỗi generateMockReturnUrl:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi tạo URL trả về.' });
    }
};