import { createVenue, getVenues } from '../controllers/venue.controller';
import express from 'express';
import { body } from 'express-validator';
import { Validate } from '../middleware/validate';
import { Verify, verifyRoles } from '../middleware/verify';

const venueRouter = express.Router();

venueRouter.post('/', Verify, verifyRoles(['admin', 'organizer']), [
    body('name').notEmpty().withMessage('Name is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('capacity').isNumeric().withMessage('Capacity must be a number'),
], Validate, createVenue);

venueRouter.get('/', getVenues);

export default venueRouter;