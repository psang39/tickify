import express from 'express';
import { getUserProfile } from '../controllers/user.controller';

const userRouter = express.Router();

userRouter.get('/profile', getUserProfile);

export default userRouter;

