import { getSeatsByZone, getSeatById, blockSeat, unblockSeat } from '../controllers/seat.controller';
import express from 'express';
import { Verify, verifyRoles, verifyCheckoutToken } from '../middleware/verify';
const seatRouter = express.Router();

seatRouter.get('/:seat_id', verifyCheckoutToken, getSeatById);
seatRouter.put('/:seat_id/block', Verify, verifyRoles(['admin', 'organizer']), blockSeat);
seatRouter.put('/:seat_id/unblock', Verify, verifyRoles(['admin', 'organizer']), unblockSeat);
