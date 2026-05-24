import express, { Request, Response } from 'express';
import { createEvent, getEvents, getEventById } from '../controllers/event.controller';
import { body } from 'express-validator';
import { Validate } from '../middleware/validation.middleware';
import { cachedMiddleware } from '../middleware/cache.middleware';
import { Verify, verifyRoles } from '../middleware/auth.middleware';
import { createShow, getShowsByEvent } from "../controllers/show.controller";
const eventRouter = express.Router();

eventRouter.get('/:event_id', getEvents);
eventRouter.post('/', Verify, verifyRoles(['admin', 'organizer']), [
    body('name').notEmpty().withMessage('Name is required'),
    body('description').notEmpty().withMessage('Description is required'),
], Validate, createEvent);


eventRouter.post('/:event_id/shows', Verify, verifyRoles(['admin', 'organizer']), [
    body('name').notEmpty().withMessage('Show name is required'),
    body('start_time').notEmpty().withMessage('Start time is required').isISO8601().toDate(),
    body('end_time').notEmpty().withMessage('End time is required').isISO8601().toDate(),
    body('venue_id').notEmpty().withMessage('Venue ID is required'),
    Validate
], createShow);


eventRouter.get('/:event_id/shows', getShowsByEvent);



eventRouter.get('/:id', cachedMiddleware, getEventById);


export default eventRouter;