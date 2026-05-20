import { getOrganizerEvents, createEvent, getOrganizerEventById } from "../controllers/event.controller";
import { createTicketType } from "../controllers/ticket-type.controller";
import { getOrganizerShowsByEvent } from "../controllers/show.controller";
import { getShowById } from "../controllers/show.controller";
import express from 'express';
const organizerRouter = express.Router();

organizerRouter.get('/events', getOrganizerEvents);
organizerRouter.post('/events', createEvent);
organizerRouter.get('/events/:event_id', getOrganizerEventById)
organizerRouter.get('/events/:event_id/shows', getOrganizerShowsByEvent);
organizerRouter.post('/events/:event_id/ticket-types', createTicketType);
organizerRouter.get('/shows/:show_id', getShowById);
export default organizerRouter;