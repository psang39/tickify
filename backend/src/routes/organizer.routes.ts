import { getOrganizerEvents, createEvent, getOrganizerEventById, publishEvent, unpublishEvent, deleteEvent, cancelEvent } from "../controllers/event.controller";
import { createTicketType } from "../controllers/ticket-type.controller";
import { getOrganizerShowsByEvent, publishShow, unpublishShow, cancelShow } from "../controllers/show.controller";
import { getShowById } from "../controllers/show.controller";
import express from 'express';
const organizerRouter = express.Router();

organizerRouter.get('/events', getOrganizerEvents);
organizerRouter.post('/events', createEvent);
organizerRouter.get('/events/:event_id', getOrganizerEventById)
organizerRouter.get('/events/:event_id/shows', getOrganizerShowsByEvent);
organizerRouter.post('/events/:event_id/ticket-types', createTicketType);
organizerRouter.get('/shows/:show_id', getShowById);
organizerRouter.post('/shows/:show_id/publish', publishShow);
organizerRouter.post('/shows/:show_id/unpublish', unpublishShow);
organizerRouter.post('/shows/:show_id/cancel', cancelShow);
organizerRouter.post('/events/:event_id/publish', publishEvent);
organizerRouter.post('/events/:event_id/unpublish', unpublishEvent);
organizerRouter.delete('/events/:event_id', deleteEvent);
organizerRouter.post('/events/:event_id/cancel', cancelEvent);

export default organizerRouter;