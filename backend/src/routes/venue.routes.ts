import { createVenue, getVenues } from '../controllers/venue.controller';
import express from 'express';
import { body } from 'express-validator';
import { Validate } from '../middleware/validation.middleware';
import { Verify, verifyRoles } from '../middleware/auth.middleware';

const venueRouter = express.Router();

venueRouter.post('/', Verify, verifyRoles(['admin', 'organizer', 'Admin', 'Organizer']), [
    body('name').notEmpty().withMessage('Name is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('city').notEmpty().withMessage('City is required'),
], Validate, createVenue);

venueRouter.get('/', getVenues);

export default venueRouter;