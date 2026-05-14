// file: src/routes/admin.routes.ts
import express from 'express';
import { getSystemDashboard, getAllUsers, verifyOrganizer } from '../controllers/admin.controller';
import { Verify, verifyRoles } from '../middleware/verify';

const adminRouter = express.Router();

// BẤT DI BẤT DỊCH: Mọi route ở đây đều phải qua 2 lớp cửa
adminRouter.use(Verify, verifyRoles(['Admin']));

// --- Các API thống kê ---
adminRouter.get('/dashboard', getSystemDashboard);

// --- Các API quản lý User ---
adminRouter.get('/users', getAllUsers);
adminRouter.patch('/organizers/:userId/verify', verifyOrganizer);

export default adminRouter;