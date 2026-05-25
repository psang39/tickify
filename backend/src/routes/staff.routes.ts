import { Verify, verifyRoles } from '../middleware/auth.middleware';
import { Router } from 'express';
import {
    getMyAssignedShows,
    getShowById,
    getShowPublicKey,
    onlineCheckIn,
    syncOfflineCheckIns,
} from '../controllers/staff.controller';

const staffRouter = Router();

staffRouter.use(Verify, verifyRoles(['staff', 'Staff']));
staffRouter.get('/my-shows', getMyAssignedShows);
staffRouter.get('/shows/:show_id', getShowById);
staffRouter.get('/shows/:show_id/public-key', getShowPublicKey);
staffRouter.post('/shows/:show_id/check-in', onlineCheckIn);
staffRouter.post('/shows/:show_id/sync-checkins', syncOfflineCheckIns);

export default staffRouter;
