import Express from "express";
import authRoutes from "./auth";
import eventRouter from "./event.routes";
import { Verify, verifyRoles } from "../middleware/verify";
import orderRoutes from "./order.routes";
import ticketRoutes from "./ticket.routes";
import ticketTypeRoutes from "./ticket-type.routes";
import waitingRoomRouter from "./waiting-room.routes";
import showRouter from "./show.routes";
import adminRoutes from "./admin.routes";
import venueRoutes from "./venue.routes";
import zoneRouter from "./zone.routes";
import organizerRouter from "./organizer.routes";
import paymentRouter from "./payment.routes";
import webhookRouter from "./webhook.routes";
import userRouter from "./user.routes";
const router = Express.Router();
router.get("/", (req, res) => {
    try {
        res.status(200).json({
            status: "success",
            data: [],
            message: "Welcome to our API homepage!",
        });
    } catch (err) {
        res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    }
})
router.use('/auth', authRoutes);
router.use('/events', eventRouter);
router.use('/shows', showRouter);
router.use('/organizer', Verify, verifyRoles(['admin', 'organizer']), organizerRouter);
router.get('/admin', Verify, verifyRoles(['admin']), adminRoutes);
router.use('/user', Verify, userRouter);
// router.get('/user', Verify, verifyRoles(['user']), (req, res) => {
//     res.status(200).json({
//         status: "success",
//         message: "Welcome to the your Dashboard!",
//     })
// });
router.use('/orders', orderRoutes);
router.use('/tickets', ticketRoutes);
router.use('/ticket-types', ticketTypeRoutes);
router.use('/waiting-room', waitingRoomRouter);
router.use('/admin', adminRoutes);
router.use('/venues', venueRoutes);
router.use('/zones', zoneRouter);
router.use('/payments', paymentRouter);
router.use('/webhooks', webhookRouter);

export default router;
