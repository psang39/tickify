import type { Request, Response } from 'express';
import Order from '../../models/order.model';
import Seat from '../../models/seat.model';
import redisClient from '../../utils/redisClient';
import { finalizeReleasedSeatMetadata } from '../zone-summary.service';
import { releaseReservationRows } from './reservation-redis.service';

/** Performs the durable cancellation before any Redis inventory release. */
export const releaseBooking = async (req: Request, res: Response): Promise<void> => {
    const user_id = req.user!.id;
    const { order_id } = req.body;
    if (!order_id) {
        res.status(400).json({ message: 'Vui lòng cung cấp mã đơn hàng.' });
        return;
    }
    try {
        const order = await Order.findOneAndUpdate(
            { _id: order_id, user_id, status: 'pending' },
            { $set: { status: 'cancelled' } },
            { returnDocument: 'before' },
        );
        if (!order) {
            const existingOrder = await Order.exists({ _id: order_id, user_id });
            if (existingOrder) {
                res.status(400).json({ message: 'Order is no longer pending.' });
                return;
            }
            res.status(404).json({ message: 'Không tìm thấy đơn hàng của bạn.' });
            return;
        }
        if (order.status !== 'pending') {
            res.status(400).json({ message: 'Đơn hàng này không ở trạng thái chờ xử lý.' });
            return;
        }
        const seatIds = order.items.map(item => item.seat_id.toString());
        const { event_id, show_id, zone_id } = order;
        const strEventId = event_id.toString();
        const strShowId = show_id.toString();
        const strZoneId = zone_id.toString();
        const seatsToRelease = await Seat.find({ _id: { $in: seatIds } });
        const seatsByRow: Record<string, typeof seatsToRelease> = {};
        seatsToRelease.forEach(seat => {
            if (!seatsByRow[seat.row]) seatsByRow[seat.row] = [];
            seatsByRow[seat.row].push(seat);
        });
        await releaseReservationRows({
            eventId: strEventId,
            showId: strShowId,
            zoneId: strZoneId,
            userId: user_id,
            seatsByRow,
        });
        const { releasedSeatIds } = await finalizeReleasedSeatMetadata({
            eventId: strEventId,
            showId: strShowId,
            zoneId: strZoneId,
            seats: seatsToRelease.map(seat => ({
                id: seat._id.toString(), row: seat.row, colIndex: Number(seat.col_index),
                ticketTypeId: seat.ticket_type_id?.toString?.() || null,
            })),
        });
        for (const seatId of releasedSeatIds) {
            await redisClient.publish('SEAT_UPDATES', JSON.stringify({ show_id: strShowId, seat_id: seatId, status: 'available' }));
        }
        res.status(200).json({ message: 'Đã hủy giữ chỗ thành công.', data: { order_id } });
    } catch (error) {
        console.error('[BookingReleaseService] Lỗi releaseSeats:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ khi nhả ghế.' });
    }
};
