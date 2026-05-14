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
const router = Express.Router();
// home route with the get method and a handler
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
// Use the authentication routes
router.use('/auth', authRoutes);

// Use the event routes
router.use('/events', eventRouter);

// Use the show routes
router.use('/shows', showRouter);

router.use('/organizer', Verify, verifyRoles(['admin', 'organizer']), organizerRouter);
router.get('/admin', Verify, verifyRoles(['admin']), adminRoutes);

router.get('/user', Verify, verifyRoles(['user']), (req, res) => {
    res.status(200).json({
        status: "success",
        message: "Welcome to the your Dashboard!",
    })
});



router.use('/orders', orderRoutes);
router.use('/tickets', ticketRoutes);
router.use('/ticket-types', ticketTypeRoutes);
router.use('/waiting-room', waitingRoomRouter);
router.use('/admin', adminRoutes);
router.use('/venues', venueRoutes);
router.use('/zones', zoneRouter);

export default router;

