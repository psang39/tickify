import '../setup-env';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test, { after, before, beforeEach } from 'node:test';

import {
    assertBookingStateConsistent,
    captureBookingState,
} from '../helpers/booking-consistency.helper';
import {
    createPendingOrderForFixture,
    markFixtureSeatAsHeld,
    seedBookingFixture,
} from '../helpers/booking.fixture';
import {
    closeTestInfrastructure,
    connectTestInfrastructure,
    resetTestInfrastructure,
} from '../helpers/infrastructure.helper';
import {
    postJson,
    startTestHttpServer,
    type TestHttpServer,
} from '../helpers/http.helper';
import { createTestApp } from '../helpers/test-app.helper';

type Deferred = {
    promise: Promise<void>;
    resolve: () => void;
};

const deferred = (): Deferred => {
    let resolve!: () => void;
    const promise = new Promise<void>(complete => {
        resolve = complete;
    });
    return { promise, resolve };
};

const successfulWebhookPayload = (orderId: string, amount: number, transactionId: string) => {
    const rawData = `order_id=${orderId}&amount=${amount}&status=SUCCESS&transactionId=${transactionId}`;
    return {
        order_id: orderId,
        amount,
        status: 'SUCCESS',
        transaction_id: transactionId,
        signature: crypto
            .createHmac('sha256', process.env.MOCK_PAYMENT_SECRET as string)
            .update(rawData)
            .digest('hex'),
    };
};

let httpServer: TestHttpServer;

before(async () => {
    await connectTestInfrastructure();
    httpServer = await startTestHttpServer(await createTestApp());
});

beforeEach(async () => {
    await resetTestInfrastructure();
});

after(async () => {
    if (httpServer) await httpServer.close();
    await closeTestInfrastructure();
});

test('payment confirmation racing a stale expiration attempt leaves a converged sold reservation', async (t) => {
    const fixture = await seedBookingFixture();
    const order = await createPendingOrderForFixture(fixture);
    await markFixtureSeatAsHeld(fixture);

    const [{ default: Order }, { processOrderExpiration }, { default: OutboxEvent }, {
        applyPaymentConfirmedProjection,
    }] = await Promise.all([
        import('../../src/models/order.model'),
        import('../../src/queues/orderExpiration.queue'),
        import('../../src/models/outbox-event.model'),
        import('../../src/services/payment-projection.service'),
    ]);

    const expirationRead = deferred();
    const resumeExpiration = deferred();
    const originalFindById = Order.findById;
    const RealDate = Date;
    let expirationReadIsPaused = false;

    // Expiration reads the still-pending order in a transaction and pauses before
    // its status/deadline check. Payment therefore commits while the reservation is
    // valid. The test advances the clock only for expiration's resumed stale view.
    (Order as any).findById = function patchedFindById(...args: any[]) {
        const query = originalFindById.apply(this, args);
        if (!expirationReadIsPaused) {
            expirationReadIsPaused = true;
            const originalExec = query.exec.bind(query);
            query.exec = async (...execArgs: any[]) => {
                const document = await originalExec(...execArgs);
                expirationRead.resolve();
                await resumeExpiration.promise;
                return document;
            };
        }
        return query;
    };
    t.after(() => {
        (Order as any).findById = originalFindById;
        (globalThis as any).Date = RealDate;
    });

    const expirationAttempt = processOrderExpiration({
        id: `expire-${order._id}`,
        data: {
            order_id: order._id,
            event_id: fixture.eventId,
            show_id: fixture.showId,
            zone_id: fixture.zoneId,
            seat_ids: [fixture.seatId],
        },
    } as any);

    await expirationRead.promise;

    const orderAtPaymentAttempt = await originalFindById.call(Order, order._id).lean();
    assert.equal(orderAtPaymentAttempt?.status, 'pending');

    const webhookResponse = await postJson(
        httpServer.baseUrl,
        '/api/v1/webhooks/payment-result',
        successfulWebhookPayload(order._id.toString(), fixture.price, 'txn-payment-vs-expiration'),
    );
    assert.equal(
        webhookResponse.status,
        200,
        `payment response=${JSON.stringify(webhookResponse.body)} order-at-payment=${JSON.stringify(orderAtPaymentAttempt)}`,
    );

    const outboxEvent = await OutboxEvent.findOne({
        aggregate_id: order._id.toString(),
        event_type: 'payment.confirmed',
    }).lean();
    assert.ok(outboxEvent, 'payment confirmation must create an outbox event');
    await applyPaymentConfirmedProjection(outboxEvent.payload as any);

    const expirationClockMs = new RealDate(order.cancellation_deadline).getTime() + 1_000;
    class ExpirationClockDate extends RealDate {
        constructor(...args: any[]) {
            super(...(args.length ? args : [expirationClockMs]) as [any]);
        }

        static now(): number {
            return expirationClockMs;
        }
    }
    (globalThis as any).Date = ExpirationClockDate;
    resumeExpiration.resolve();
    const expirationOutcome = await expirationAttempt.then(
        result => ({ kind: 'resolved' as const, result }),
        error => ({ kind: 'rejected' as const, error: String(error) }),
    );

    const state = await captureBookingState(fixture, [order._id.toString()]);
    assert.equal(
        state.orders[0]?.status,
        'confirmed',
        `stale expiration outcome=${JSON.stringify(expirationOutcome)} final state=${JSON.stringify(state)}`,
    );
    assertBookingStateConsistent(state, 'converged');
});
