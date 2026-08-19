import { orderExpirationQueue } from '../../queues/orderExpiration.queue';
import { HOLD_DURATION_SECONDS } from './reservation-redis.service';

/** Keeps BullMQ job construction at the reservation lifecycle boundary. */
export const enqueueReservationExpiration = async (params: {
    orderId: unknown;
    eventId: string;
    showId: string;
    zoneId: string;
    seatIds: string[];
}) => orderExpirationQueue.add(
    `expire-${params.orderId}`,
    {
        order_id: params.orderId as any,
        event_id: params.eventId,
        show_id: params.showId,
        zone_id: params.zoneId,
        seat_ids: params.seatIds,
    },
    { delay: HOLD_DURATION_SECONDS * 1000 },
);
