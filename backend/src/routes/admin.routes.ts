
import express from 'express';
import { getSystemDashboard, getAllUsers, getPendingOrganizers, verifyOrganizer, rejectOrganizer, getVenues, verifyVenue, rejectVenue } from '../controllers/admin.controller';

import { Verify, verifyRoles } from '../middleware/auth.middleware';

const adminRouter = express.Router();
adminRouter.use(Verify, verifyRoles(['Admin']));
adminRouter.get('/dashboard', getSystemDashboard);
adminRouter.get('/users', getAllUsers);
adminRouter.get('/organizers/pending', getPendingOrganizers);
adminRouter.put('/organizers/:userId/verify', verifyOrganizer);
adminRouter.delete('/organizers/:userId/reject', rejectOrganizer);
adminRouter.get('/venues', getVenues);
adminRouter.put('/venues/:venue_id/verify', verifyVenue);
adminRouter.delete('/venues/:venue_id/reject', rejectVenue);


export default adminRouter;