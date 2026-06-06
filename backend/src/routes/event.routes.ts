import express, { Request, Response } from 'express';
import { createEvent, getEvents, getEventById, searchEventsPublic } from '../controllers/event.controller';
import { body } from 'express-validator';
import { Validate } from '../middleware/validation.middleware';
import { cachedMiddleware } from '../middleware/cache.middleware';
import { Verify, verifyRoles } from '../middleware/auth.middleware';
import { createShow, getShowsByEvent } from "../controllers/show.controller";
const eventRouter = express.Router();

eventRouter.get('/search', searchEventsPublic);
eventRouter.get('/', getEvents);
eventRouter.post('/', Verify, verifyRoles(['Admin', 'admin', 'Organizer', 'organizer']), [
    body('name').notEmpty().withMessage('Name is required'),
    body('description').notEmpty().withMessage('Description is required'),
], Validate, createEvent);



eventRouter.get('/:event_id/shows', getShowsByEvent);



eventRouter.get('/:id', cachedMiddleware, getEventById);


export default eventRouter;