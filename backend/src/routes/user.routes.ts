import express from 'express';
import { getUserProfile } from '../controllers/user.controller';
import { Verify } from '../middleware/verify';

const userRouter = express.Router();

userRouter.get('/profile', getUserProfile);

export default userRouter;

