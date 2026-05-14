// file: src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import Order from '../models/order.model';

export const createPaymentUrl = async (req: Request, res: Response): Promise<void> => {
    try {
        const user_id = req.user?.id;
        const { orderId, billingName, billingPhone, billingEmail, paymentMethod } = req.body;

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

        // Kiểm tra xem đơn hàng đã quá 10 phút chưa (Đề phòng Frontend chặn lỗi trễ)
        if (new Date() > new Date(order.cancellation_deadline)) {
            res.status(400).json({ message: 'Đơn hàng đã hết thời gian giữ chỗ (10 phút).' });
            return;
        }

        // 2. CẬP NHẬT THÔNG TIN LIÊN HỆ VÀO ORDER (Để lát nữa Webhook biết đường gửi Email)
        order.billing_name = billingName;
        order.billing_phone = billingPhone;
        order.billing_email = billingEmail;
        await order.save();

        // 3. SINH URL CHUYỂN HƯỚNG THANH TOÁN TÙY THEO PHƯƠNG THỨC
        let paymentUrl = '';

        if (paymentMethod === 'VNPAY') {
            // Logic tạo URL của VNPay (cần mã hóa bằng Secret Key của VNPay)
            // paymentUrl = generateVNPayUrl(order, req); 

        } else if (paymentMethod === 'MOCK') {
            // Trong đồ án, để dễ demo, ta tạo ra một trang Frontend tên là /mock-gateway
            // Ta truyền orderId và số tiền qua URL parameters để trang đó hiển thị lên màn hình

            const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            paymentUrl = `${frontendBaseUrl}/mock-gateway?orderId=${order._id}&amount=${order.total_price}`;

        } else {
            res.status(400).json({ message: 'Phương thức thanh toán không hợp lệ.' });
            return;
        }

        // 4. TRẢ URL VỀ CHO FRONTEND ĐỂ REDIRECT
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