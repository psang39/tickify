import assert from 'node:assert/strict';

import type { BookingFixture } from './booking.fixture';

export type OracleMode = 'reservation' | 'durable-payment' | 'converged';

export interface BookingStateSnapshot {
    orderIds: string[];
    orders: Array<{
        id: string;
        userId: string;
        status: string;
        totalPrice: number;
        deadline: string | null;
        seatIds: string[];
    }>;
    durableSeatStatus: string | null;
    rowString: string | null;
    rowCharacter: string | null;
    lockOwner: string | null;
    lockTtlMs: number;
    heldCounts: Record<string, number>;
    dynamicSeatStatus: string | null;
    inHoldingSet: boolean;
    availableTierCount: number | null;
    validQuantities: unknown;
    payments: Array<{
        orderId: string;
        amount: number;
        status: string;
        transactionId: string | null;
    }>;
    tickets: Array<{
        orderId: string;
        seatId: string;
        status: string;
    }>;
    outboxEvents: Array<{
        aggregateId: string;
        eventType: string;
        status: string;
    }>;
}

const normalizeId = (value: any): string => value?._id?.toString?.()
    || value?.toString?.()
    || String(value);

export const captureBookingState = async (
    fixture: BookingFixture,
    orderIds?: Array<string | { toString(): string }>,
): Promise<BookingStateSnapshot> => {
    const [
        { default: Order },
        { default: Seat },
        { default: Payment },
        { default: Ticket },
        { default: OutboxEvent },
        { default: redisClient },
    ] = await Promise.all([
        import('../../src/models/order.model'),
        import('../../src/models/seat.model'),
        import('../../src/models/payment.model'),
        import('../../src/models/ticket.model'),
        import('../../src/models/outbox-event.model'),
        import('../../src/utils/redisClient'),
    ]);

    const requestedOrderIds = orderIds?.map(String);
    const orderFilter = requestedOrderIds?.length
        ? { _id: { $in: requestedOrderIds } }
        : { show_id: fixture.showId };

    const orders = await Order.find(orderFilter).lean() as any[];
    const discoveredOrderIds = orders.map(order => normalizeId(order._id));
    const relatedOrderIds = requestedOrderIds?.length
        ? requestedOrderIds
        : discoveredOrderIds;

    const [seat, payments, tickets, outboxEvents] = await Promise.all([
        Seat.findById(fixture.seatId).lean() as Promise<any>,
        Payment.find({ order_id: { $in: relatedOrderIds } }).lean() as Promise<any[]>,
        Ticket.find({ order_id: { $in: relatedOrderIds } }).lean() as Promise<any[]>,
        OutboxEvent.find({ aggregate_id: { $in: relatedOrderIds } }).lean() as Promise<any[]>,
    ]);

    const [
        rowString,
        lockOwner,
        lockTtlMs,
        heldCountA,
        heldCountB,
        dynamicSeatStatus,
        inHoldingSet,
        availableTierCountRaw,
        validQuantitiesRaw,
    ] = await Promise.all([
        redisClient.get(fixture.rowKey),
        redisClient.get(fixture.seatLockKey),
        redisClient.pTTL(fixture.seatLockKey),
        redisClient.get(fixture.heldCountKeyForA),
        redisClient.get(
            `event:${fixture.eventId}:show:${fixture.showId}:user:${fixture.attendeeBId}:held_count`,
        ),
        redisClient.hGet(fixture.statusHashKey, fixture.seatId),
        redisClient.sIsMember(fixture.holdingSetKey, fixture.seatId),
        redisClient.hGet(fixture.summaryKey, `tier:${fixture.ticketTypeId}:count`),
        redisClient.hGet(fixture.summaryKey, 'valid_quantities'),
    ]);

    let validQuantities: unknown = validQuantitiesRaw;
    if (validQuantitiesRaw) {
        try {
            validQuantities = JSON.parse(validQuantitiesRaw);
        } catch {
            // Preserve malformed Redis data in the snapshot for diagnostic output.
        }
    }

    return {
        orderIds: relatedOrderIds,
        orders: orders.map(order => ({
            id: normalizeId(order._id),
            userId: normalizeId(order.user_id),
            status: String(order.status),
            totalPrice: Number(order.total_price),
            deadline: order.cancellation_deadline
                ? new Date(order.cancellation_deadline).toISOString()
                : null,
            seatIds: (order.items || []).map((item: any) => normalizeId(item.seat_id)),
        })),
        durableSeatStatus: seat?.status ? String(seat.status) : null,
        rowString,
        rowCharacter: rowString?.[0] || null,
        lockOwner,
        lockTtlMs,
        heldCounts: {
            [fixture.attendeeAId]: Number(heldCountA || 0),
            [fixture.attendeeBId]: Number(heldCountB || 0),
        },
        dynamicSeatStatus,
        inHoldingSet: Boolean(inHoldingSet),
        availableTierCount: availableTierCountRaw === null
            ? null
            : Number(availableTierCountRaw),
        validQuantities,
        payments: payments.map(payment => ({
            orderId: normalizeId(payment.order_id),
            amount: Number(payment.amount),
            status: String(payment.status),
            transactionId: payment.transaction_id ? String(payment.transaction_id) : null,
        })),
        tickets: tickets.map(ticket => ({
            orderId: normalizeId(ticket.order_id),
            seatId: normalizeId(ticket.seat_id),
            status: String(ticket.status),
        })),
        outboxEvents: outboxEvents.map(event => ({
            aggregateId: String(event.aggregate_id),
            eventType: String(event.event_type),
            status: String(event.status),
        })),
    };
};

export const findBookingInvariantViolations = (
    state: BookingStateSnapshot,
    mode: OracleMode = 'converged',
): string[] => {
    const violations: string[] = [];
    const nowMs = Date.now();
    const activeOrders = state.orders.filter(order => (
        order.status === 'confirmed'
        || (
            order.status === 'pending'
            && (!order.deadline || new Date(order.deadline).getTime() > nowMs)
        )
    ));

    const activeSeatOwners = new Map<string, string[]>();
    for (const order of activeOrders) {
        for (const seatId of order.seatIds) {
            const owners = activeSeatOwners.get(seatId) || [];
            owners.push(order.id);
            activeSeatOwners.set(seatId, owners);
        }
    }
    for (const [seatId, owners] of activeSeatOwners) {
        if (owners.length > 1) {
            violations.push(`seat ${seatId} belongs to multiple active orders: ${owners.join(', ')}`);
        }
    }

    for (const order of state.orders) {
        const payments = state.payments.filter(payment => payment.orderId === order.id);
        const tickets = state.tickets.filter(ticket => ticket.orderId === order.id);
        const outboxEvents = state.outboxEvents.filter(event => event.aggregateId === order.id);
        if (order.status === 'pending') {
            const isExpired = Boolean(
                order.deadline && new Date(order.deadline).getTime() <= nowMs,
            );
            if (isExpired) violations.push(`order ${order.id} remains pending past its deadline`);
            if (state.rowCharacter !== 'H') violations.push(`pending order ${order.id} has Redis row ${state.rowCharacter}`);
            if (!state.lockOwner) violations.push(`pending order ${order.id} has no seat lock`);
            if (state.lockOwner && state.lockOwner !== order.userId) {
                violations.push(`pending order ${order.id} lock belongs to ${state.lockOwner}`);
            }
            if (state.dynamicSeatStatus !== 'holding') {
                violations.push(`pending order ${order.id} has dynamic status ${state.dynamicSeatStatus}`);
            }
            if (!state.inHoldingSet) violations.push(`pending order ${order.id} is absent from holding set`);
            if (state.heldCounts[order.userId] < order.seatIds.length) {
                violations.push(`pending order ${order.id} is missing held_count quota`);
            }
            if (payments.length || tickets.length || outboxEvents.length) {
                violations.push(`pending order ${order.id} already has payment/ticket/outbox side effects`);
            }
        }

        if (order.status === 'confirmed') {
            if (state.durableSeatStatus !== 'sold') {
                violations.push(`confirmed order ${order.id} durable seat is ${state.durableSeatStatus}`);
            }
            if (payments.length !== 1) violations.push(`confirmed order ${order.id} has ${payments.length} payments`);
            if (tickets.length !== order.seatIds.length) {
                violations.push(`confirmed order ${order.id} has ${tickets.length} tickets for ${order.seatIds.length} items`);
            }
            if (outboxEvents.length !== 1) {
                violations.push(`confirmed order ${order.id} has ${outboxEvents.length} payment outbox events`);
            }
            if (payments[0] && payments[0].amount !== order.totalPrice) {
                violations.push(`confirmed order ${order.id} paid ${payments[0].amount}, expected ${order.totalPrice}`);
            }
            if (mode === 'converged') {
                if (state.rowCharacter !== 'S') violations.push(`confirmed order ${order.id} Redis row is ${state.rowCharacter}`);
                if (state.lockOwner) violations.push(`confirmed order ${order.id} retains lock ${state.lockOwner}`);
                if (state.dynamicSeatStatus !== 'sold') {
                    violations.push(`confirmed order ${order.id} dynamic status is ${state.dynamicSeatStatus}`);
                }
                if (state.inHoldingSet) violations.push(`confirmed order ${order.id} remains in holding set`);
            }
        }

        if (order.status === 'cancelled') {
            const successor = activeOrders.find(candidate => (
                candidate.id !== order.id
                && candidate.seatIds.some(seatId => order.seatIds.includes(seatId))
            ));
            if (!successor) {
                if (state.rowCharacter === 'H') violations.push(`cancelled order ${order.id} leaves Redis row held`);
                if (state.lockOwner) violations.push(`cancelled order ${order.id} leaves lock ${state.lockOwner}`);
                if (state.dynamicSeatStatus === 'holding') {
                    violations.push(`cancelled order ${order.id} leaves dynamic holding status`);
                }
                if (state.inHoldingSet) violations.push(`cancelled order ${order.id} remains in holding set`);
                if (state.heldCounts[order.userId] > 0) {
                    violations.push(`cancelled order ${order.id} leaves held_count ${state.heldCounts[order.userId]}`);
                }
            } else if (successor.status === 'pending') {
                if (state.rowCharacter !== 'H') {
                    violations.push(`successor ${successor.id} is pending but row is ${state.rowCharacter}`);
                }
                if (state.lockOwner !== successor.userId) {
                    violations.push(`successor ${successor.id} lock owner is ${state.lockOwner}`);
                }
            }
            if (payments.length || tickets.length || outboxEvents.length) {
                violations.push(`cancelled order ${order.id} has payment/ticket/outbox side effects`);
            }
        }
    }

    return violations;
};

export const assertBookingStateConsistent = (
    state: BookingStateSnapshot,
    mode: OracleMode = 'converged',
): void => {
    const violations = findBookingInvariantViolations(state, mode);
    assert.deepEqual(
        violations,
        [],
        `Booking invariant violations:\n${violations.join('\n')}\nFinal state:\n${JSON.stringify(state, null, 2)}`,
    );
};
