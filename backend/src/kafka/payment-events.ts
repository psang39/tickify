import crypto from 'crypto';

export const PAYMENT_EVENTS_TOPIC = 'payment-events';
export const PAYMENT_PROJECTION_GROUP = 'tickify-payment-projection-v1';

export interface PaymentConfirmedEvent {
    eventId: string;
    type: 'payment.confirmed';
    version: 1;
    occurredAt: string;
    data: {
        orderId: string;
        transactionId: string;
        eventId: string;
        showId: string;
        userId: string;
        seatIds: string[];
        amount: number;
    };
}

export const createPaymentConfirmedEvent = (
    data: PaymentConfirmedEvent['data'],
): PaymentConfirmedEvent => ({
    eventId: crypto.randomUUID(),
    type: 'payment.confirmed',
    version: 1,
    occurredAt: new Date().toISOString(),
    data,
});

export const isPaymentConfirmedEvent = (
    value: unknown,
): value is PaymentConfirmedEvent => {
    if (!value || typeof value !== 'object') return false;

    const event = value as Partial<PaymentConfirmedEvent>;
    const data = event.data as Partial<PaymentConfirmedEvent['data']> | undefined;

    return (
        typeof event.eventId === 'string' &&
        event.type === 'payment.confirmed' &&
        event.version === 1 &&
        typeof event.occurredAt === 'string' &&
        !!data &&
        typeof data.orderId === 'string' &&
        typeof data.transactionId === 'string' &&
        typeof data.eventId === 'string' &&
        typeof data.showId === 'string' &&
        typeof data.userId === 'string' &&
        Array.isArray(data.seatIds) &&
        data.seatIds.every((seatId) => typeof seatId === 'string') &&
        typeof data.amount === 'number'
    );
};
