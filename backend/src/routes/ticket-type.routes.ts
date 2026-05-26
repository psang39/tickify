import { Router } from "express";
import {
    getTicketTypesByShow,
    getTicketTypeById,
    updateTicketType,
    deleteTicketType
} from "../controllers/ticket-type.controller";
import { Verify } from "../middleware/auth.middleware";

const router = Router();

export default router;
