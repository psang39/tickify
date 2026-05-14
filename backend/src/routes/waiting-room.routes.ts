import { joinWaitingRoom, checkMyTurn } from '../controllers/waiting-room.controller';
import express from 'express';
import { Verify } from '../middleware/verify';
const waitingRoomRouter = express.Router();

waitingRoomRouter.post('/:show_id/join', Verify, joinWaitingRoom);
waitingRoomRouter.get('/:show_id/status', Verify, checkMyTurn);

export default waitingRoomRouter;