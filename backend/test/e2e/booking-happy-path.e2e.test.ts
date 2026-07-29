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
import { postJson, startTestHttpServer, type TestHttpServer } from '../helpers/http.helper';
import { seedBookingFixture } from '../helpers/booking.fixture';

let httpServer: TestHttpServer;

before(async () => {
    await connectTestInfrastructure();
    httpServer = await startTestHttpServer(await createTestApp());
});

beforeEach(resetTestInfrastructure);

after(async () => {
    if (httpServer) await httpServer.close();
    await closeTestInfrastructure();
});

test('happy path: hold seat, pay, issue QR ticket and check in', async () => {
    const fixture = await seedBookingFixture();
    const attendeeHeaders = {
        authorization: `Bearer ${fixture.attendeeAToken}`,
        'x-checkout-token': fixture.checkoutToken,
    };

    const holdResponse = await postJson<any>(
        httpServer.baseUrl,
        '/api/v1/orders/hold',
        { items: [{ seat_id: fixture.seatId, ticket_type_id: fixture.ticketTypeId }] },
        attendeeHeaders,
    );
    assert.equal(holdResponse.status, 201);
    const orderId = holdResponse.body.data.order_id as string;

    const transactionId = 'txn-e2e-happy-path';
    const rawData = `order_id=${orderId}&amount=${fixture.price}&status=SUCCESS&transactionId=${transactionId}`;
    const paymentResponse = await postJson(
        httpServer.baseUrl,
        '/api/v1/webhooks/payment-result',
        {
            order_id: orderId,
            amount: fixture.price,
            status: 'SUCCESS',
            transaction_id: transactionId,
            signature: crypto
                .createHmac('sha256', process.env.MOCK_PAYMENT_SECRET as string)
                .update(rawData)
                .digest('hex'),
        },
    );
    assert.equal(paymentResponse.status, 200);

    const [
        { default: Order },
        { default: Ticket },
        { generateCurrentToken },
        { createTicketQrPayload },
    ] = await Promise.all([
        import('../../src/models/order.model'),
        import('../../src/models/ticket.model'),
        import('../../src/config/totp.util'),
        import('../../src/domain/qr-payload'),
    ]);
    const order = await Order.findById(orderId).lean();
    const ticket = await Ticket.findOne({ order_id: orderId }).lean();

    assert.equal(order?.status, 'confirmed');
    assert.ok(ticket);

    const qrData = createTicketQrPayload({
        ticketId: ticket._id.toString(),
        ticketSecret: ticket.ticket_secret,
        currentTotpCode: await generateCurrentToken(ticket.ticket_secret),
        signature: ticket.signature,
    });
    const checkInResponse = await postJson(
        httpServer.baseUrl,
        `/api/v1/staff/shows/${fixture.showId}/check-in`,
        { qrData, deviceId: 'scanner-e2e' },
        { authorization: `Bearer ${fixture.staffToken}` },
    );

    assert.equal(checkInResponse.status, 200);
    assert.equal((await Ticket.findById(ticket._id).lean())?.status, 'USED');
});
