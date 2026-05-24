import { holdSeats, releaseSeats, getOrders } from '../controllers/order.controller';
import { getMyTickets } from '../controllers/ticket.controller';
import express from 'express';
import { Verify, verifyCheckoutToken } from '../middleware/auth.middleware';
import { getPaymentResult } from "../controllers/payment.controller";

const orderRouter = express.Router();

orderRouter.post('/hold', Verify, verifyCheckoutToken, holdSeats);
orderRouter.post('/release', Verify, verifyCheckoutToken, releaseSeats);

orderRouter.get('/', Verify, getOrders);
orderRouter.get('/:order_id/tickets', Verify, getMyTickets);
orderRouter.get('/:order_id/payment-result', Verify, getPaymentResult);


export default orderRouter;