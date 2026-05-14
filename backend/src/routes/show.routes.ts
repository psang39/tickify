import { createShow, getShowById, publishShow } from "../controllers/show.controller";
import { joinWaitingRoom, checkMyTurn } from '../controllers/waiting-room.controller';
import { getSeatsByShow } from "../controllers/seat.controller";
import express from 'express';
import { body } from 'express-validator';
import { Validate } from '../middleware/validate';
import { Verify, verifyRoles, verifyCheckoutToken } from '../middleware/verify';
import { createZone, getZonesByEvent } from "../controllers/zone.controller";
import { addClient } from '../services/sse.service';


const showRouter = express.Router({ mergeParams: true });
showRouter.get('/:show_id', getShowById);
showRouter.get('/:show_id/zones', verifyCheckoutToken, getZonesByEvent);

showRouter.post('/:show_id/zones', Verify, verifyRoles(['admin', 'organizer']), [
    body('name').notEmpty().withMessage('Name is required'),
    body('event_id').notEmpty().withMessage('Event ID is required'),
    body('show_id').notEmpty().withMessage('Show ID is required'),
    body('venue_id').notEmpty().withMessage('Venue ID is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be a positive integer'),
], Validate, createZone);

showRouter.post('/:show_id/waiting-room/join', Verify, joinWaitingRoom);
showRouter.get('/:show_id/waiting-room/status', Verify, checkMyTurn);
showRouter.patch('/:id/publish', Verify, verifyRoles(['admin', 'organizer']), publishShow);
showRouter.get('/:show_id/seats', Verify, verifyCheckoutToken, getSeatsByShow);
showRouter.get('/:show_id/stream', (req, res) => {
    const { show_id } = req.params;
    addClient(show_id, res);
});
export default showRouter;