import type { Request, Response } from 'express';
import Order from '../../models/order.model';
import Seat from '../../models/seat.model';
import Zone from '../../models/zone.model';
import User from '../../models/user.model';
import TicketType from '../../models/ticket-type.model';
import Show from '../../models/show.model';
import redisClient from '../../utils/redisClient';
import { updateZoneSummaryAfterHold } from '../zone-summary.service';
import { calculateReservationExpiry } from '../../domain/reservation';
import { isRedisUnavailableError } from '../../utils/redisErrors';
import {
    buildOrderTickets,
    groupReservationItems,
    validateBookableShow,
    validateBookingRequest,
    validateReferencedBookingData,
    validateSeatSelection,
    type BookingItem,
} from './booking-validation.service';
import {
    HOLD_DURATION_SECONDS,
    buildRowHoldCommand,
    holdReservationRow,
    rollbackLocksAndRows,
    type ModifiedRow,
} from './reservation-redis.service';
import { HoldMetrics } from './hold-metrics.service';
import { enqueueReservationExpiration } from './reservation-expiration.service';

/** Coordinates the existing booking saga; HTTP response mapping stays here so
 * the controller can remain a thin route adapter. */
export const holdBooking = async (req: Request, res: Response): Promise<void> => {
    const metrics = new HoldMetrics();
    const { user_id, items, event_id, show_id } = metrics.measureSync('requestItemNormalization', () => ({
        user_id: req.user!.id,
        items: req.body.items as BookingItem[],
        event_id: req.checkoutData.event_id,
        show_id: req.checkoutData.show_id,
    }));
    const currentUser = await metrics.measure('validationDataLookup', () => User.findById(user_id));
    if (!currentUser) throw new Error('Không tìm thấy thông tin người dùng hợp lệ.');

    const requestFailure = validateBookingRequest({ eventId: event_id, showId: show_id, items });
    if (requestFailure) {
        res.status(requestFailure.status).json(requestFailure.body);
        return;
    }

    const targetShow = await metrics.measure('validationDataLookup', () => Show.findById(show_id)
        .select('event_id status sale_start sale_end start_time end_time')
        .lean());
    const showFailure = metrics.measureSync('availabilityBusinessRules', () => validateBookableShow({
        show: targetShow,
        eventId: event_id,
    }));
    if (showFailure) {
        res.status(showFailure.status).json(showFailure.body);
        return;
    }

    const { seat_ids, ticket_type_ids } = metrics.measureSync('requestItemNormalization', () => ({
        seat_ids: items.map(item => item.seat_id),
        ticket_type_ids: items.map(item => item.ticket_type_id),
    }));
    const successfullyLockedSeats: string[] = [];
    const modifiedRowsForRollback: ModifiedRow[] = [];
    let zone_id = '';
    let createdOrderId: string | null = null;

    try {
        const targetSeats = await metrics.measure('validationDataLookup', () => Seat.find({ _id: { $in: seat_ids } }));
        const selection = metrics.measureSync('availabilityBusinessRules', () => validateSeatSelection(targetSeats, seat_ids.length));
        if ('status' in selection) {
            res.status(selection.status).json(selection.body);
            return;
        }
        zone_id = selection.zoneId;
        const selectedZone = await metrics.measure('validationDataLookup', () => Zone.findById(zone_id).lean());
        if (!selectedZone) {
            res.status(404).json({ message: 'Không tìm thấy khu vực của vé.' });
            return;
        }

        const { seatsByRow, lockedByTier } = metrics.measureSync(
            'requestItemNormalization',
            () => groupReservationItems(items, targetSeats),
        );
        metrics.measureSync('logging', () => console.log('Số lượng vé theo từng loại đang giữ trong request này:', lockedByTier));

        for (const rowLabel in seatsByRow) {
            const seatsInRow = seatsByRow[rowLabel];
            const { keys, args } = metrics.measureSync('redisKeyArgumentConstruction', () => buildRowHoldCommand({
                eventId: event_id,
                showId: show_id,
                zoneId: zone_id,
                userId: user_id,
                rowLabel,
                seats: seatsInRow,
            }));
            try {
                const previousRowString = await metrics.measure('redisLuaHold', () => holdReservationRow({
                    isStanding: selectedZone.is_standing,
                    keys,
                    args,
                }));
                metrics.measureSync('postHoldStatePreparation', () => {
                    seatsInRow.forEach(seat => successfullyLockedSeats.push(seat._id.toString()));
                    if (typeof previousRowString !== 'string') {
                        throw new Error('Redis hold did not return a rollback row snapshot.');
                    }
                    modifiedRowsForRollback.push({ rowLabel, prevString: previousRowString });
                });
            } catch (error: any) {
                const errMsg = error.message;
                await rollbackLocksAndRows(event_id, show_id, zone_id, user_id, successfullyLockedSeats, modifiedRowsForRollback);
                if (errMsg.includes('SEAT_UNAVAILABLE')) {
                    res.status(409).json({ message: `Ghế ở hàng ${rowLabel} đã bị người khác giữ!` }); return;
                }
                if (errMsg.includes('ORPHAN_SEAT_VIOLATION')) {
                    res.status(400).json({ message: `Lỗi để trống ghế lẻ tại hàng ${rowLabel}. Vui lòng chọn lại!` }); return;
                }
                if (errMsg.includes('ROW_NOT_FOUND')) {
                    res.status(500).json({ message: 'Dữ liệu sơ đồ ghế chưa được khởi tạo.' }); return;
                }
                if (errMsg.includes('EXCEED_MAX_TICKETS_LIMIT')) {
                    res.status(400).json({ message: 'Bạn chỉ có thể giữ tối đa 4 vé cho một suất chiếu.' }); return;
                }
                console.error('Lỗi giữ ghế:', error);
                res.status(503).json({ message: 'Dịch vụ giữ chỗ tạm thời không khả dụng.' }); return;
            }
        }

        const statusHashKey = `show:${show_id}:seat_status`;
        await metrics.measure('summaryStatusUpdates', async () => {
            for (const seat_id of successfullyLockedSeats) {
                const stringShowId = show_id.toString();
                await redisClient.hSet(statusHashKey, seat_id.toString(), 'holding');
                metrics.measureSync('logging', () => console.log(`📢 [Trạm 1] Đang publish cho ghế ${seat_id} của Show ${stringShowId}`));
                await redisClient.publish('SEAT_UPDATES', JSON.stringify({ show_id: stringShowId, seat_id: seat_id.toString(), status: 'holding' }));
            }
        });
        const { uniqueSeatIds, uniqueTicketTypeIds } = metrics.measureSync('postHoldStatePreparation', () => ({
            uniqueSeatIds: [...new Set(seat_ids.map(String))],
            uniqueTicketTypeIds: [...new Set(ticket_type_ids.map(String))],
        }));
        const seatsFromDb = await metrics.measure('validationDataLookup', () => Seat.find({ _id: { $in: uniqueSeatIds } }));
        const ticketTypesFromDb = await metrics.measure('validationDataLookup', () => TicketType.find({ _id: { $in: uniqueTicketTypeIds } })) as any[];
        validateReferencedBookingData({
            seatCount: seatsFromDb.length,
            expectedSeatCount: uniqueSeatIds.length,
            ticketTypeCount: ticketTypesFromDb.length,
            expectedTicketTypeCount: uniqueTicketTypeIds.length,
        });
        const { totalPrice, orderTicketsData } = metrics.measureSync('ticketPriceConstruction', () => buildOrderTickets({
            items,
            seats: seatsFromDb,
            ticketTypes: ticketTypesFromDb,
            isStanding: selectedZone.is_standing,
        }));
        const { cancellation_deadline, orderPayload } = metrics.measureSync('postHoldStatePreparation', () => {
            const deadline = calculateReservationExpiry(new Date(), HOLD_DURATION_SECONDS);
            return {
                cancellation_deadline: deadline,
                orderPayload: {
                    order_number: `TKF-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
                    user_id, event_id, show_id, zone_id,
                    items: orderTicketsData,
                    total_price: totalPrice,
                    status: 'pending' as const,
                    cancellation_deadline: deadline,
                    purchaser_name: `${currentUser.first_name} ${currentUser.last_name}`,
                    purchaser_email: currentUser.email,
                    purchaser_phone: currentUser.phone,
                },
            };
        });
        const newOrder = await metrics.measure('mongoOrderCreation', () => Order.create(orderPayload));
        createdOrderId = newOrder._id.toString();
        await metrics.measure('summaryStatusUpdates', () => updateZoneSummaryAfterHold({
            eventId: event_id, showId: show_id, zoneId: zone_id,
            modifiedRows: modifiedRowsForRollback, lockedByTicketType: lockedByTier, seatIds: seat_ids,
        }));
        await metrics.measure('bullExpirationEnqueue', () => enqueueReservationExpiration({
            orderId: newOrder._id,
            eventId: event_id,
            showId: show_id,
            zoneId: zone_id,
            seatIds: seat_ids,
        }));
        metrics.recordOnSuccess(res);
        const responseBody = metrics.measureSync('responseObjectConstruction', () => ({
            message: 'Giữ chỗ thành công!',
            data: {
                order_id: newOrder._id, total_price: newOrder.total_price, lockedSeats: seat_ids,
                cancellation_deadline: newOrder.cancellation_deadline, server_now: new Date(),
            },
        }));
        metrics.measureSync('responseSerializationDispatch', () => res.status(201).json(responseBody));
    } catch (error: any) {
        if (successfullyLockedSeats.length > 0 && zone_id) {
            await rollbackLocksAndRows(event_id, show_id, zone_id, user_id, successfullyLockedSeats, modifiedRowsForRollback);
            await redisClient.hDel(`show:${show_id}:seat_status`, successfullyLockedSeats);
        }
        if (createdOrderId) await Order.findByIdAndUpdate(createdOrderId, { status: 'cancelled' });
        const redisUnavailable = isRedisUnavailableError(error);
        res.status(redisUnavailable ? 503 : 400).json({
            message: redisUnavailable ? 'Dịch vụ giữ chỗ tạm thời không khả dụng.' : error.message || 'Lỗi hệ thống nội bộ.',
        });
    }
};
