import { holdSeats, releaseSeats, rollbackLocksAndRows, getOrders, getOrderById } from '../controllers/order.controller';
import { getMyTickets } from '../controllers/ticket.controller';
import express from 'express';
import { body } from 'express-validator';
import { Verify, verifyCheckoutToken } from '../middleware/verify';

const orderRouter = express.Router();

orderRouter.post('/hold', Verify, verifyCheckoutToken, holdSeats);
orderRouter.post('/release', Verify, verifyCheckoutToken, releaseSeats);

orderRouter.get('/', Verify, getOrders);
orderRouter.get('/:order_id/tickets', Verify, getMyTickets);


export default orderRouter;