import { getMyTickets, getTicketDetail, syncCheckIn } from '../controllers/ticket.controller';
import { Validate } from '../middleware/validate';
import { Verify, verifyRoles } from '../middleware/verify';
import express from 'express';
const ticketRouter = express.Router();

// Lấy danh sách vé của người dùng đã đăng nhập
ticketRouter.get('/me', Validate, getMyTickets);



// Lấy chi tiết vé
ticketRouter.get('/:ticketId', Verify, getTicketDetail);

ticketRouter.post('/tickets/:ticketId/sync-checkin', verifyRoles(['staff']), syncCheckIn);

export default ticketRouter;