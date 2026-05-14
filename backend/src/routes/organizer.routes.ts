import { getOrganizerEvents, createEvent, getOrganizerEventById } from "../controllers/event.controller";
import { createTicketType } from "../controllers/ticket-type.controller";
import { getShowsByEvent } from "../controllers/show.controller";
import express from 'express';
const organizerRouter = express.Router();

organizerRouter.get('/events', getOrganizerEvents);
organizerRouter.post('/events', createEvent);
organizerRouter.get('/events/:event_id', getOrganizerEventById)
organizerRouter.get('/events/:event_id/shows', getShowsByEvent);
organizerRouter.post('/events/:event_id/ticket-types', createTicketType);

export default organizerRouter;