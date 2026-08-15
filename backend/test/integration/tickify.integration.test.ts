import '../setup-env';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test, { after, before, beforeEach } from 'node:test';

import {
    closeTestInfrastructure,
    connectTestInfrastructure,
    resetTestInfrastructure,
} from '../helpers/infrastructure.helper';
import { createTestApp } from '../helpers/test-app.helper';
import {
    postJson,
    requestJson,
    startTestHttpServer,
    type TestHttpServer,
} from '../helpers/http.helper';
import {
    createPendingOrderForFixture,
    markFixtureSeatAsHeld,
    seedBookingFixture,
} from '../helpers/booking.fixture';

let httpServer: TestHttpServer;

before(async () => {
    await connectTestInfrastructure();
    const app = await createTestApp();
    httpServer = await startTestHttpServer(app);
});

beforeEach(async () => {
    await resetTestInfrastructure();
});

after(async () => {
    if (httpServer) await httpServer.close();
    await closeTestInfrastructure();
});

const authHeaders = (accessToken: string, checkoutToken?: string) => ({
    authorization: `Bearer ${accessToken}`,
    ...(checkoutToken ? { 'x-checkout-token': checkoutToken } : {}),
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

test('two attendees racing for the same seat produce exactly one successful hold', async () => {
    const fixture = await seedBookingFixture();
    const body = {
        items: [{ seat_id: fixture.seatId, ticket_type_id: fixture.ticketTypeId }],
    };

    const responses = await Promise.all([
        postJson(httpServer.baseUrl, '/api/v1/orders/hold', body, authHeaders(
            fixture.attendeeAToken,
            fixture.checkoutToken,
        )),
        postJson(httpServer.baseUrl, '/api/v1/orders/hold', body, authHeaders(
            fixture.attendeeBToken,
            fixture.checkoutToken,
        )),
    ]);

    assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);

    const [{ default: Order }, { default: redisClient }] = await Promise.all([
        import('../../src/models/order.model'),
        import('../../src/utils/redisClient'),
    ]);
    assert.equal(await Order.countDocuments({ status: 'pending' }), 1);
    assert.equal(await redisClient.get(fixture.rowKey), 'H');
    assert.ok(await redisClient.get(fixture.seatLockKey));
});

test('missing booking items returns a validation error without creating an order', async () => {
    const fixture = await seedBookingFixture();
    const response = await postJson(
        httpServer.baseUrl,
        '/api/v1/orders/hold',
        { items: [] },
        authHeaders(fixture.attendeeAToken, fixture.checkoutToken),
    );

    const { default: Order } = await import('../../src/models/order.model');
    assert.equal(response.status, 400);
    assert.equal((response.body as any).message, 'Dữ liệu đầu vào không hợp lệ.');
    assert.equal(await Order.countDocuments(), 0);
});

test('Redis unavailability returns 503 and does not leave a pending order', async () => {
    const fixture = await seedBookingFixture();
    const { default: redisClient } = await import('../../src/utils/redisClient');
    redisClient.disconnect();

    try {
        const response = await postJson(
            httpServer.baseUrl,
            '/api/v1/orders/hold',
            { items: [{ seat_id: fixture.seatId, ticket_type_id: fixture.ticketTypeId }] },
            authHeaders(fixture.attendeeAToken, fixture.checkoutToken),
        );

        const { default: Order } = await import('../../src/models/order.model');
        assert.equal(response.status, 503);
        assert.equal((response.body as any).message, 'Dịch vụ giữ chỗ tạm thời không khả dụng.');
        assert.equal(await Order.countDocuments(), 0);
    } finally {
        if (!redisClient.isOpen) await redisClient.connect();
    }
});

test('an expired reservation is cancelled and its Redis seat state is released', async () => {
    const fixture = await seedBookingFixture();
    const order = await createPendingOrderForFixture(fixture, { expired: true });
    await markFixtureSeatAsHeld(fixture);

    const { processOrderExpiration } = await import('../../src/queues/orderExpiration.queue');
    const result = await processOrderExpiration({
        id: `expire-${order._id}`,
        data: {
            order_id: order._id,
            event_id: fixture.eventId,
            show_id: fixture.showId,
            zone_id: fixture.zoneId,
            seat_ids: [fixture.seatId],
        },
    } as any);

    const [{ default: Order }, { default: redisClient }] = await Promise.all([
        import('../../src/models/order.model'),
        import('../../src/utils/redisClient'),
    ]);
    const storedOrder = await Order.findById(order._id).lean();

    assert.equal(result, 'expired');
    assert.equal(storedOrder?.status, 'cancelled');
    assert.equal(await redisClient.get(fixture.rowKey), 'O');
    assert.equal(await redisClient.get(fixture.seatLockKey), null);
    assert.equal(await redisClient.hGet(fixture.statusHashKey, fixture.seatId), null);
    assert.equal(await redisClient.sIsMember(fixture.holdingSetKey, fixture.seatId), 0);
    assert.equal(
        await redisClient.hGet(fixture.summaryKey, `tier:${fixture.ticketTypeId}:count`),
        '1',
    );
});

test('replayed payment webhooks create one payment, one ticket and one outbox event', async () => {
    const fixture = await seedBookingFixture();
    const order = await createPendingOrderForFixture(fixture);
    await markFixtureSeatAsHeld(fixture);
    const payload = successfulWebhookPayload(order._id.toString(), fixture.price, 'txn-idempotency-1');

    const responses = await Promise.all([
        postJson(httpServer.baseUrl, '/api/v1/webhooks/payment-result', payload),
        postJson(httpServer.baseUrl, '/api/v1/webhooks/payment-result', payload),
    ]);

    const [
        { default: Order },
        { default: Payment },
        { default: Ticket },
        { default: OutboxEvent },
    ] = await Promise.all([
        import('../../src/models/order.model'),
        import('../../src/models/payment.model'),
        import('../../src/models/ticket.model'),
        import('../../src/models/outbox-event.model'),
    ]);

    assert.deepEqual(responses.map(response => response.status), [200, 200]);
    assert.equal((await Order.findById(order._id).lean())?.status, 'confirmed');
    assert.equal(await Payment.countDocuments({ order_id: order._id }), 1);
    assert.equal(await Ticket.countDocuments({ order_id: order._id }), 1);
    assert.equal(await OutboxEvent.countDocuments({
        aggregate_id: order._id.toString(),
        event_type: 'payment.confirmed',
    }), 1);
});

test('an attendee cannot call staff-only endpoints', async () => {
    const fixture = await seedBookingFixture();
    const response = await requestJson(
        httpServer.baseUrl,
        '/api/v1/staff/my-shows',
        { headers: authHeaders(fixture.attendeeAToken) },
    );

    assert.equal(response.status, 403);
    assert.match((response.body as any).error, /permission/i);
});

test('a ticket cannot be checked in twice', async () => {
    const fixture = await seedBookingFixture();
    const order = await createPendingOrderForFixture(fixture);
    await order.updateOne({ status: 'confirmed' });

    const [
        { default: Ticket },
        { generateTicketSecret, generateCurrentToken },
        { signTicketIdentity, createTicketQrPayload },
    ] = await Promise.all([
        import('../../src/models/ticket.model'),
        import('../../src/config/totp.util'),
        import('../../src/domain/qr-payload'),
    ]);

    const { default: mongoose } = await import('mongoose');
    const ticketId = new mongoose.Types.ObjectId();
    const ticketSecret = await generateTicketSecret();
    const signature = signTicketIdentity(ticketId.toString(), ticketSecret, fixture.privateKey);
    await Ticket.create({
        _id: ticketId,
        order_id: order._id,
        user_id: fixture.attendeeAId,
        event_id: fixture.eventId,
        show_id: fixture.showId,
        zone_id: fixture.zoneId,
        seat_id: fixture.seatId,
        ticket_type_id: fixture.ticketTypeId,
        ticket_secret: ticketSecret,
        signature,
        status: 'VALID',
    });

    const qrData = createTicketQrPayload({
        ticketId: ticketId.toString(),
        ticketSecret,
        currentTotpCode: await generateCurrentToken(ticketSecret),
        signature,
    });
    const path = `/api/v1/staff/shows/${fixture.showId}/check-in`;
    const first = await postJson(httpServer.baseUrl, path, { qrData, deviceId: 'scanner-a' }, authHeaders(fixture.staffToken));
    const second = await postJson(httpServer.baseUrl, path, { qrData, deviceId: 'scanner-b' }, authHeaders(fixture.staffToken));

    const { default: CheckInLog } = await import('../../src/models/check-in-log.model');
    assert.equal(first.status, 200);
    assert.equal(second.status, 409);
    assert.equal((await Ticket.findById(ticketId).lean())?.status, 'USED');
    assert.equal(await CheckInLog.countDocuments({ ticket_id: ticketId, result: 'SUCCESS' }), 1);
    assert.equal(await CheckInLog.countDocuments({ ticket_id: ticketId, result: 'DUPLICATE' }), 1);
});
