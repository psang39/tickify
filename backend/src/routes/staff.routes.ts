import { Verify, verifyRoles } from '../middleware/verify';
import { Router } from 'express';
import { getMyAssignedShows, getShowById } from '../controllers/staff.controller';

const staffRouter = Router();

staffRouter.get('/my-shows', Verify, verifyRoles(['staff', 'Staff']), getMyAssignedShows);
staffRouter.get('/shows/:show_id', Verify, verifyRoles(['staff', 'Staff']), getShowById);

export default staffRouter;