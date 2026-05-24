import express from 'express';
import { getZoneById, updateZone, checkZoneAvailability } from '../controllers/zone.controller';
import { body } from 'express-validator';
import { Validate } from '../middleware/validation.middleware';
import { verifyRoles, Verify, verifyCheckoutToken } from '../middleware/auth.middleware';
import { getSeatsByZone } from '../controllers/seat.controller';
const zoneRouter = express.Router({ mergeParams: true });


zoneRouter.get('/:zone_id', verifyCheckoutToken, getZoneById);

zoneRouter.put('/:zone_id', Verify, verifyRoles(['admin', 'organizer']), [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
], Validate, updateZone);

// zoneRouter.post('/:zone_id/seats', Verify, [
//     body('rows').isInt({ min: 1 }).withMessage('Rows must be a positive integer'),
//     body('columns').isInt({ min: 1 }).withMessage('Columns must be a positive integer')
// ], Validate, generateSeatsForZone);

zoneRouter.get('/:zone_id/availability', checkZoneAvailability);

zoneRouter.get('/:zone_id/seats', verifyCheckoutToken, getSeatsByZone);


export default zoneRouter;