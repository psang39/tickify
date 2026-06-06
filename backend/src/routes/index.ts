import Express from 'express';

import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import eventRouter from './event.routes';
import orderRoutes from './order.routes';
import organizerRouter from './organizer.routes';
import paymentRouter from './payment.routes';
import showRouter from './show.routes';
import ticketRoutes from './ticket.routes';
import ticketTypeRoutes from './ticket-type.routes';
import userRouter from './user.routes';
import venueRoutes from './venue.routes';
import waitingRoomRouter from './waiting-room.routes';
import webhookRouter from './webhook.routes';
import zoneRouter from './zone.routes';
import staffRouter from './staff.routes';
import seatRouter from './seat.routes';
import { Verify, verifyRoles } from '../middleware/auth.middleware';

const router = Express.Router();

router.get('/', (_req, res) => {
    res.status(200).json({
        status: 'success',
        data: [],
        message: 'Welcome to our API homepage!',
    });
});

router.use('/auth', authRoutes);
router.use('/events', eventRouter);
router.use('/shows', showRouter);
router.use('/organizer', Verify, verifyRoles(['Organizer', 'organizer']), organizerRouter);
router.use('/user', Verify, userRouter);
router.use('/orders', orderRoutes);
router.use('/tickets', ticketRoutes);
router.use('/ticket-types', ticketTypeRoutes);
router.use('/waiting-room', waitingRoomRouter);
router.use('/admin', Verify, verifyRoles(['admin', 'Admin']), adminRoutes);
router.use('/venues', venueRoutes);
router.use('/zones', zoneRouter);
router.use('/seats', seatRouter);
router.use('/payments', paymentRouter);
router.use('/webhooks', webhookRouter);
router.use('/staff', staffRouter);

export default router;
