import { holdSeats, getMyOrders, getOrderDetail, releaseSeats } from '../controllers/order.controller';
import express from 'express';
import { body } from 'express-validator';
import { Verify, verifyCheckoutToken } from '../middleware/verify';

const orderRouter = express.Router();

orderRouter.post('/hold', verifyCheckoutToken, holdSeats);
orderRouter.post('/release', verifyCheckoutToken, releaseSeats);

orderRouter.get('/me', Verify, getMyOrders);
orderRouter.get('/:orderId', Verify, getOrderDetail);

export default orderRouter;