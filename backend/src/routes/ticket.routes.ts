import { getTicketDetail, syncCheckIn } from '../controllers/ticket.controller';
import { Verify, verifyRoles } from '../middleware/auth.middleware';
import express from 'express';
const ticketRouter = express.Router();

// Legacy/manual sync endpoint. Main scanner flow uses /staff/shows/:show_id/sync-checkins.
ticketRouter.post('/:ticket_id/sync-checkin', Verify, verifyRoles(['Staff', 'staff']), syncCheckIn);
ticketRouter.post('/tickets/:ticket_id/sync-checkin', Verify, verifyRoles(['Staff', 'staff']), syncCheckIn);
ticketRouter.get('/:ticket_id', Verify, getTicketDetail);

export default ticketRouter;
