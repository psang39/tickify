import { getSeatById, blockSeat, unblockSeat } from '../controllers/seat.controller';
import express from 'express';
import { Verify, verifyRoles, verifyCheckoutToken } from '../middleware/auth.middleware';
const seatRouter = express.Router();

seatRouter.get('/:seat_id', verifyCheckoutToken, getSeatById);
seatRouter.put('/:seat_id/block', Verify, verifyRoles(['Admin', 'admin', 'Organizer', 'organizer']), blockSeat);
seatRouter.put('/:seat_id/unblock', Verify, verifyRoles(['Admin', 'admin', 'Organizer', 'organizer']), unblockSeat);

export default seatRouter;
