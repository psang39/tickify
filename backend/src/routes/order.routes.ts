import { holdSeats, getMyOrders, getOrderDetail, releaseSeats, rollbackLocksAndRows } from '../controllers/order.controller';
import express from 'express';
import { body } from 'express-validator';
import { Verify, verifyCheckoutToken } from '../middleware/verify';

const orderRouter = express.Router();

orderRouter.post('/hold', Verify, verifyCheckoutToken, holdSeats);
orderRouter.post('/release', Verify, verifyCheckoutToken, releaseSeats);

orderRouter.get('/me', Verify, getMyOrders);
orderRouter.get('/:orderId', Verify, getOrderDetail);

export default orderRouter;