import { Request, Response } from 'express';
import crypto from 'crypto';
import Order from '../models/order.model';
import Payment from '../models/payment.model';
import Seat from '../models/seat.model';
import redisClient from '../utils/redisClient';
import { generateTicketsForOrder } from '../services/ticket.service';

// Đây là mã bí mật giữa Server Dề Dê và Mock Payment Gateway.
// Chỉ 2 bên biết. Lưu vào file .env
const MOCK_PAYMENT_SECRET = process.env.MOCK_PAYMENT_SECRET || 'super_secret_key_123';

export const handleMockPaymentWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const { order_id, amount, status, transaction_id, signature } = req.body;

        console.log(`[WEBHOOK] Nhận tín hiệu thanh toán cho Order: ${order_id}`);

        const rawData = `order_id=${order_id}&amount=${amount}&status=${status}&transactionId=${transaction_id}`;

        const expectedSignature = crypto
            .createHmac('sha256', MOCK_PAYMENT_SECRET)
            .update(rawData)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error(`[WEBHOOK] Chữ ký không hợp lệ! Có kẻ gian giả mạo.`);
            res.status(400).json({ message: "Invalid signature" });
            return;
        }

        // BƯỚC 2: XỬ LÝ LOGIC NGHIỆP VỤ (VỚI TÍNH LŨY ĐẲNG)

        if (status === 'SUCCESS') {
            // Tìm đơn hàng
            const order = await Order.findById(order_id);

            if (!order) {
                res.status(404).json({ message: "Order not found" });
                return;
            }

            // KIỂM TRA LŨY ĐẲNG (Idempotency)
            // Nếu đơn đã PAID rồi (do webhook gọi trùng lần 2), thì kệ nó, vẫn báo OK.
            if (order.status === 'confirmed') {
                res.status(200).json({ message: "OK" });
                return;
            }

            order.status = 'confirmed';
            const payment = new Payment({
                order_id: order._id,
                amount: amount,
                payment_method: 'mock',
                status: 'confirmed',
                transaction_id: transaction_id,
                processed_at: new Date()
            });
            await payment.save();
            await order.save();

            // 2.1 Cập nhật ghế trong MongoDB thành 'SOLD' (Màu xám)
            await Seat.updateMany(
                { _id: { $in: order.items.map((item: any) => item.seat_id) } },
                { $set: { status: 'sold' } }
            );

            // 2.2 Phá khóa trên Redis ngay lập tức (Không cần đợi hết 10 phút)
            for (const seat_id of order.items.map((item: any) => item.seat_id)) {
                await redisClient.del(`event:${order.event_id}:show:${order.show_id}:seat:${seat_id}:lock`);
            }
            await redisClient.DECRBY(`event:${order.event_id}:show:${order.show_id}:user:${order.user_id}:held_count`, order.items.length);

            // BƯỚC 3: GỌI HÀM NỘI BỘ ĐỂ XUẤT VÉ

            console.log(`[WEBHOOK] Bắt đầu đẻ vé cho Order: ${order_id}`);
            // Gọi service (không cần req, res) như ta đã bàn ở lần trước
            await generateTicketsForOrder(order._id.toString());
            console.log(`[WEBHOOK] Xử lý hoàn tất Order: ${order_id}`);
        } else {
            await Order.findByIdAndUpdate(order_id, { status: 'CANCELLED' });
        }


        // BƯỚC 4: TRẢ LỜI CHO CỔNG THANH TOÁN
        // Webhook BẮT BUỘC phải trả về 200 OK càng nhanh càng tốt.
        // Nếu không, cổng thanh toán sẽ tưởng mạng lỗi và chốc nữa nó lại gọi tiếp.
        res.status(200).json({ message: "OK" });

    } catch (error) {
        console.error('[WEBHOOK] Lỗi hệ thống:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};