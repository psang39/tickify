import { getTicketDetail, syncCheckIn } from '../controllers/ticket.controller';
import { Verify, verifyRoles } from '../middleware/auth.middleware';
import express from 'express';
const ticketRouter = express.Router();

ticketRouter.get('/:ticket_id', Verify, getTicketDetail);
ticketRouter.post('/tickets/:ticket_id/sync-checkin', verifyRoles(['staff']), syncCheckIn);

export default ticketRouter;