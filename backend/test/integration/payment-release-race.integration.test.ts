import '../setup-env';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test, { after, before, beforeEach } from 'node:test';

import {
    captureBookingState,
    findBookingInvariantViolations,
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

const authHeaders = (accessToken: string, checkoutToken: string) => ({
    authorization: `Bearer ${accessToken}`,
    'x-checkout-token': checkoutToken,
});

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

test('payment confirmation racing a stale explicit release leaves a converged sold reservation', async (t) => {
    const fixture = await seedBookingFixture();
    const order = await createPendingOrderForFixture(fixture);
    await markFixtureSeatAsHeld(fixture);

    const [{ default: Order }, { default: OutboxEvent }, {
        applyPaymentConfirmedProjection,
    }] = await Promise.all([
        import('../../src/models/order.model'),
        import('../../src/models/outbox-event.model'),
        import('../../src/services/payment-projection.service'),
    ]);

    const releaseTransitionPaused = deferred();
    const resumeRelease = deferred();
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    let releaseTransitionIsPaused = false;

    // Pause immediately before the release path evaluates its atomic
    // { id, owner, status: pending } -> cancelled transition. Payment can win
    // first; resuming release must then produce no Redis inventory mutation.
    (Order as any).findOneAndUpdate = function patchedFindOneAndUpdate(...args: any[]) {
        const query = originalFindOneAndUpdate.apply(this, args);
        if (!releaseTransitionIsPaused) {
            releaseTransitionIsPaused = true;
            const originalExec = query.exec.bind(query);
            query.exec = async (...execArgs: any[]) => {
                releaseTransitionPaused.resolve();
                await resumeRelease.promise;
                return originalExec(...execArgs);
            };
        }
        return query;
    };
    t.after(() => {
        (Order as any).findOneAndUpdate = originalFindOneAndUpdate;
    });

    const releaseAttempt = postJson(
        httpServer.baseUrl,
        '/api/v1/orders/release',
        { order_id: order._id.toString() },
        authHeaders(fixture.attendeeAToken, fixture.checkoutToken),
    );

    await releaseTransitionPaused.promise;
    const orderAtPaymentAttempt = await Order.findById(order._id).lean();
    assert.equal(orderAtPaymentAttempt?.status, 'pending');

    const paymentResponse = await postJson(
        httpServer.baseUrl,
        '/api/v1/webhooks/payment-result',
        successfulWebhookPayload(order._id.toString(), fixture.price, 'txn-payment-vs-release'),
    );
    assert.equal(
        paymentResponse.status,
        200,
        `payment response=${JSON.stringify(paymentResponse.body)}`,
    );

    const outboxEvent = await OutboxEvent.findOne({
        aggregate_id: order._id.toString(),
        event_type: 'payment.confirmed',
    }).lean();
    assert.ok(outboxEvent, 'payment confirmation must create an outbox event');
    await applyPaymentConfirmedProjection(outboxEvent.payload as any);

    resumeRelease.resolve();
    const releaseResponse = await releaseAttempt;
    assert.equal(
        releaseResponse.status,
        400,
        `release response=${JSON.stringify(releaseResponse.body)}`,
    );

    const state = await captureBookingState(fixture, [order._id.toString()]);
    const violations = findBookingInvariantViolations(state, 'converged');
    assert.deepEqual(
        {
            orderStatus: state.orders[0]?.status,
            violations,
        },
        {
            orderStatus: 'confirmed',
            violations: [],
        },
        `payment response=${JSON.stringify(paymentResponse.body)} release response=${JSON.stringify(releaseResponse.body)} final state=${JSON.stringify(state, null, 2)}`,
    );
});
