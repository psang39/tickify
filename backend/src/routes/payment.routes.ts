
import express from 'express';
import { createPaymentUrl } from '../controllers/payment.controller';
import { Verify, verifyCheckoutToken } from '../middleware/verify';

const paymentRouter = express.Router();

paymentRouter.post('/create-url', Verify, verifyCheckoutToken, createPaymentUrl);

export default paymentRouter;