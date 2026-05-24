
import express from 'express';
import { createPaymentUrl, generateMockReturnUrl } from '../controllers/payment.controller';
import { Verify, verifyCheckoutToken } from '../middleware/auth.middleware';

const paymentRouter = express.Router();

paymentRouter.post('/create-url', Verify, verifyCheckoutToken, createPaymentUrl);
paymentRouter.post('/mock/generate-return-url', generateMockReturnUrl);
export default paymentRouter;