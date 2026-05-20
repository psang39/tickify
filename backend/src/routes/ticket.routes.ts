import { getMyTickets, getTicketDetail, syncCheckIn } from '../controllers/ticket.controller';
import { Validate } from '../middleware/validate';
import { Verify, verifyRoles } from '../middleware/verify';
import express from 'express';
const ticketRouter = express.Router();

ticketRouter.get('/me', Validate, getMyTickets);
ticketRouter.get('/:ticket_id', Verify, getTicketDetail);
ticketRouter.post('/tickets/:ticket_id/sync-checkin', verifyRoles(['staff']), syncCheckIn);

export default ticketRouter;