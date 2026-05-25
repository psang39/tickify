import express from 'express';
import { changePassword, getUserProfile } from '../controllers/user.controller';

const userRouter = express.Router();

userRouter.get('/profile', getUserProfile);
userRouter.patch('/profile/password', changePassword);

export default userRouter;

