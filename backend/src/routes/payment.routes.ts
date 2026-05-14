// file: src/routes/payment.routes.ts
import express from 'express';
import { createPaymentUrl } from '../controllers/payment.controller';
import { Verify, verifyCheckoutToken } from '../middleware/verify'; // Nếu bạn muốn khắt khe

const paymentRouter = express.Router();

// Bắt buộc phải đăng nhập mới được gọi API thanh toán
paymentRouter.use(Verify);

// Khách bấm thanh toán -> Sinh URL
paymentRouter.post('/create-url', createPaymentUrl);

export default paymentRouter;