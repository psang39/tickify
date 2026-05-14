// file: src/routes/webhook.routes.ts
import express from 'express';
import { handleMockPaymentWebhook } from '../controllers/webhook.controller';

const webhookRouter = express.Router();

// Route này hớ hênh, hoàn toàn public để VNPay/MoMo có thể gọi vào
webhookRouter.post('/payment-result', handleMockPaymentWebhook);

export default webhookRouter;