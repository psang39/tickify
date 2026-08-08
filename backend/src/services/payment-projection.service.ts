import Seat from '../models/seat.model';
import redisClient from '../utils/redisClient';
import { publishOrganizerDashboardUpdate } from './organizer-dashboard.service';
import type { PaymentConfirmedEvent } from '../kafka/payment-events';

const COUNTER_DEDUP_TTL_SECONDS = 60 * 60 * 24 * 30;

const applyCountersOnceLua = `
    local dedupKey = KEYS[1]
    local heldCountKey = KEYS[2]
    local revenueKey = KEYS[3]
    local soldCountKey = KEYS[4]

    if redis.call('EXISTS', dedupKey) == 1 then
        return 0
    end

    local ticketCount = tonumber(ARGV[1])
    local paymentAmount = tonumber(ARGV[2])
    local dedupTtl = tonumber(ARGV[3])

    local heldCount = tonumber(redis.call('GET', heldCountKey) or '0')
    local newHeldCount = heldCount - ticketCount
    if newHeldCount < 0 then
        newHeldCount = 0
    end

    redis.call('SET', heldCountKey, tostring(newHeldCount))
    redis.call('INCRBY', revenueKey, paymentAmount)
    redis.call('INCRBY', soldCountKey, ticketCount)
    redis.call('SET', dedupKey, '1', 'EX', dedupTtl)

    return 1
`;

export const applyPaymentConfirmedProjection = async (
    event: PaymentConfirmedEvent,
): Promise<void> => {
    const {
        orderId,
        eventId,
        showId,
        userId,
        seatIds,
        amount,
    } = event.data;

    const seats = await Seat.find({
        _id: { $in: seatIds },
    })
        .select('_id row col_index zone_id')
        .lean();

    if (seats.length !== seatIds.length) {
        throw new Error(
            `Payment projection ${event.eventId}: expected ${seatIds.length} seats, found ${seats.length}`,
        );
    }

    const statusHashKey = `show:${showId}:seat_status`;
    const holdingSetKey = `event:${eventId}:show:${showId}:holding_seats`;
    const heldCountKey =
        `event:${eventId}:show:${showId}:user:${userId}:held_count`;
    const revenueKey =
        `event:${eventId}:show:${showId}:total_revenue`;
    const soldCountKey =
        `event:${eventId}:show:${showId}:sold_count`;

    const seatsByZoneRow: Record<string, typeof seats> = {};
    for (const seat of seats) {
        const key = `${seat.zone_id.toString()}::${seat.row}`;
        if (!seatsByZoneRow[key]) seatsByZoneRow[key] = [];
        seatsByZoneRow[key].push(seat);
    }

    const pipeline = redisClient.multi();

    for (const [zoneRowKey, rowSeats] of Object.entries(seatsByZoneRow)) {
        const [zoneId, rowLabel] = zoneRowKey.split('::');
        const rowKey =
            `event:${eventId}:show:${showId}:zone:${zoneId}:row:${rowLabel}`;
        const rowStr = await redisClient.get(rowKey);

        if (!rowStr) continue;

        const chars = rowStr.split('');

        for (const seat of rowSeats) {
            const index = Number(seat.col_index) - 1;
            if (index >= 0 && index < chars.length) {
                chars[index] = 'S';
            }
        }

        pipeline.set(rowKey, chars.join(''));
    }

    for (const seatId of seatIds) {
        pipeline.hSet(statusHashKey, seatId, 'sold');
        pipeline.sRem(holdingSetKey, seatId);
        pipeline.del(
            `event:${eventId}:show:${showId}:seat:${seatId}:lock`,
        );
    }

    const userCheckoutTokenKey =
        `event:${eventId}:show:${showId}:user:${userId}:checkoutToken`;
    const checkoutToken = await redisClient.get(userCheckoutTokenKey);

    if (checkoutToken) {
        pipeline.del(
            `event:${eventId}:show:${showId}:checkoutToken:${checkoutToken}`,
        );
    }

    pipeline.del(userCheckoutTokenKey);
    await pipeline.exec();


    const counterApplied = await redisClient.eval(applyCountersOnceLua, {
        keys: [
            `kafka:payment-projection:processed:${event.eventId}`,
            heldCountKey,
            revenueKey,
            soldCountKey,
        ],
        arguments: [
            String(seatIds.length),
            String(amount),
            String(COUNTER_DEDUP_TTL_SECONDS),
        ],
    });

    if (Number(counterApplied) === 1) {
        console.log(
            `[Kafka Consumer] Applied counters for order ${orderId}`,
        );
    } else {
        console.log(
            `[Kafka Consumer] Duplicate ${event.eventId}; counters already applied`,
        );
    }

    for (const seatId of seatIds) {
        await redisClient.publish(
            'SEAT_UPDATES',
            JSON.stringify({
                show_id: showId,
                seat_id: seatId,
                status: 'sold',
            }),
        );
    }

    await publishOrganizerDashboardUpdate(showId);
};
