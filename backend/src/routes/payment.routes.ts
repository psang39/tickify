
import express from 'express';
import { createPaymentUrl, generateMockReturnUrl, getPaymentResult } from '../controllers/payment.controller';
import { Verify, verifyCheckoutToken } from '../middleware/auth.middleware';

const paymentRouter = express.Router();

paymentRouter.post('/create-url', Verify, createPaymentUrl);
// Backward-compatible alias for older frontend builds.
paymentRouter.get('/result/:order_id', Verify, getPaymentResult);
paymentRouter.post('/mock/generate-return-url', generateMockReturnUrl);
export default paymentRouter;