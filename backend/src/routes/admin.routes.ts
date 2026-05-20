
import express from 'express';
import { getSystemDashboard, getAllUsers, verifyOrganizer } from '../controllers/admin.controller';
import { Verify, verifyRoles } from '../middleware/verify';

const adminRouter = express.Router();
adminRouter.use(Verify, verifyRoles(['Admin']));
adminRouter.get('/dashboard', getSystemDashboard);
adminRouter.get('/users', getAllUsers);
adminRouter.patch('/organizers/:userId/verify', verifyOrganizer);

export default adminRouter;