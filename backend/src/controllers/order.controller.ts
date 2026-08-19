import { Request, Response } from 'express';
import Order from '../models/order.model';
import Ticket from '../models/ticket.model';
import User from '../models/user.model';
import { holdBooking } from '../services/booking/booking-hold.service';
import { releaseBooking } from '../services/booking/booking-release.service';

// Preserve the established module surface for focused Redis/rollback tests and
// local performance controls while keeping HTTP handlers free of Redis details.
export {
    holdSeatsLuaScript,
    rollbackLocksAndRows,
} from '../services/booking/reservation-redis.service';

/** HTTP adapter for the booking orchestration workflow. */
export const holdSeats = async (req: Request, res: Response): Promise<void> => holdBooking(req, res);

/** HTTP adapter for the durable cancellation and inventory-release workflow. */
export const releaseSeats = async (req: Request, res: Response): Promise<void> => releaseBooking(req, res);

export const getOrders = async (req: Request, res: Response) => {
    try {
        const user_id = req.user!.id;
        const attendee = await User.findById(user_id).select('-password');
        if (!attendee) {
            return res.status(404).json({ message: 'Attendee not found' });
        }
        if (attendee.id !== user_id) {
            return res.status(403).json({ message: 'Unauthorized to view orders' });
        }
        const orders = await Order.find({ user_id: user_id }).populate('event_id', 'name').sort({ created_at: -1 }).populate({
            path: 'show_id',
            select: 'name venue_id start_time',
            populate: {
                path: 'venue_id',
                model: 'Venue',
                select: 'name',
            },
        });
        const ticketNumbers = orders.flatMap(order => order.items.map(item => item.seat_id));
        res.status(200).json({ orders, ticketNumbers });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching attendee orders', error });
    }
};

export const getOrderById = async (req: Request, res: Response) => {
    try {
        const user_id = req.user!.id;
        const order_id = req.params.order_id;
        const attendee = await User.findById(user_id).select('-password');
        if (!attendee) {
            return res.status(404).json({ message: 'Attendee not found' });
        }
        const order = await Order.findById(order_id)
            .populate('event_id', 'name')
            .populate({
                path: 'show_id',
                select: 'name start_time status venue_id',
                populate: { path: 'venue_id', model: 'Venue', select: 'name' },
            })
            .lean();
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.user_id.toString() !== user_id) {
            return res.status(403).json({ message: 'Unauthorized to view this order' });
        }
        const tickets = await Ticket.find({ user_id, order_id: order._id })
            .populate('ticket_type_id')
            .populate('seat_id')
            .populate('zone_id')
            .populate('event_id')
            .lean();
        res.status(200).json({ order, tickets });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching order details', error });
    }
};
