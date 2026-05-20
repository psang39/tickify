// file: src/routes/webhook.routes.ts
import express from 'express';
import { handleMockPaymentWebhook } from '../controllers/webhook.controller';

const webhookRouter = express.Router();
webhookRouter.post('/payment-result', handleMockPaymentWebhook);

export default webhookRouter;