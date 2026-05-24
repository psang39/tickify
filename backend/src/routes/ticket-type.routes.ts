import { createTicketType, getTicketTypesByEvent, getTicketTypeById, updateTicketType, deleteTicketType } from '../controllers/ticket-type.controller';
import express from 'express';
import { body } from 'express-validator';
import { Validate } from '../middleware/validation.middleware';
import { verifyRoles } from '../middleware/auth.middleware';
const ticketTypeRoutes = express.Router();

ticketTypeRoutes.post('/', verifyRoles(['admin', 'organizer']), [
    body('name').notEmpty().withMessage('Name is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('event_id').notEmpty().withMessage('Event ID is required')
], Validate, createTicketType);

ticketTypeRoutes.get('/event/:eventId', getTicketTypesByEvent);
ticketTypeRoutes.get('/:ticketTypeId', getTicketTypeById);

ticketTypeRoutes.put('/:ticketTypeId', verifyRoles(['admin', 'organizer']), [
    body('name').optional().notEmpty().withMessage('Name is required'),
    body('price').optional().isNumeric().withMessage('Price must be a number')
], Validate, updateTicketType);

ticketTypeRoutes.delete('/:ticketTypeId', verifyRoles(['admin', 'organizer']), deleteTicketType);

export default ticketTypeRoutes;
