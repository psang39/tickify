import '../setup-env';
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import { seedBookingFixture } from '../helpers/booking.fixture';
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

test('a partial multi-row hold keeps its row unavailable until the atomic rollback begins', async (t) => {
    const fixture = await seedBookingFixture();
    const [{ default: Seat }, { default: redisClient }] = await Promise.all([
        import('../../src/models/seat.model'),
        import('../../src/utils/redisClient'),
    ]);

    const secondSeat = await Seat.create({
        seat_number: 'B1',
        zone_id: fixture.zoneId,
        event_id: fixture.eventId,
        show_id: fixture.showId,
        status: 'available',
        row: 'B',
        col_index: 1,
        tier: 'VIP',
        ticket_type_id: fixture.ticketTypeId,
    });
    const secondRowKey = `event:${fixture.eventId}:show:${fixture.showId}:zone:${fixture.zoneId}:row:B`;
    await redisClient.set(secondRowKey, 'O');

    const seatsByRowKey = new Map([
        [fixture.rowKey, fixture.seatId],
        [secondRowKey, secondSeat._id.toString()],
    ]);
    const rollbackPaused = deferred();
    const resumeRollback = deferred();
    const originalEval = redisClient.eval.bind(redisClient);
    let evalCallCount = 0;
    let partiallyHeldRowKey = '';

    // A's first row hold succeeds. Its second row operation fails, entering the
    // controller's rollback path. Pause before the single rollback EVAL reaches
    // Redis; a competing hold must still be rejected because A's row is H.
    (redisClient as any).eval = async (...args: any[]) => {
        evalCallCount += 1;
        const options = args[1] as { keys: string[] };
        if (evalCallCount === 1) {
            partiallyHeldRowKey = options.keys[0];
            return originalEval(...args);
        }
        if (evalCallCount === 2) {
            throw new Error('SEAT_UNAVAILABLE');
        }
        if (evalCallCount === 3) {
            rollbackPaused.resolve();
            await resumeRollback.promise;
        }
        return originalEval(...args);
    };
    t.after(() => {
        (redisClient as any).eval = originalEval;
    });

    const reservationA = postJson(
        httpServer.baseUrl,
        '/api/v1/orders/hold',
        {
            items: [
                { seat_id: fixture.seatId, ticket_type_id: fixture.ticketTypeId },
                { seat_id: secondSeat._id.toString(), ticket_type_id: fixture.ticketTypeId },
            ],
        },
        authHeaders(fixture.attendeeAToken, fixture.checkoutToken),
    );

    await rollbackPaused.promise;
    const partiallyHeldSeatId = seatsByRowKey.get(partiallyHeldRowKey);
    assert.ok(partiallyHeldSeatId, `unexpected first hold row ${partiallyHeldRowKey}`);
    const partiallyHeldLockKey = `event:${fixture.eventId}:show:${fixture.showId}:seat:${partiallyHeldSeatId}:lock`;

    const beforeB = {
        row: await redisClient.get(partiallyHeldRowKey),
        lock: await redisClient.get(partiallyHeldLockKey),
        heldCount: await redisClient.get(fixture.heldCountKeyForA),
    };
    assert.deepEqual(beforeB, { row: 'H', lock: fixture.attendeeAId, heldCount: '1' });

    const reservationB = await postJson(
        httpServer.baseUrl,
        '/api/v1/orders/hold',
        { items: [{ seat_id: partiallyHeldSeatId, ticket_type_id: fixture.ticketTypeId }] },
        authHeaders(fixture.attendeeBToken, fixture.checkoutToken),
    );
    assert.equal(reservationB.status, 409, `competing hold response=${JSON.stringify(reservationB.body)}`);

    const afterB = {
        row: await redisClient.get(partiallyHeldRowKey),
        lock: await redisClient.get(partiallyHeldLockKey),
        heldCount: await redisClient.get(fixture.heldCountKeyForA),
    };
    assert.deepEqual(afterB, beforeB);

    resumeRollback.resolve();
    const responseA = await reservationA;
    assert.equal(responseA.status, 409);

    const afterRollbackRow = await redisClient.get(partiallyHeldRowKey);
    assert.equal(
        afterRollbackRow,
        'O',
        `rollback captured snapshot="O" but restored row=${JSON.stringify(afterRollbackRow)}`,
    );
});

test('rollback restores every saved row snapshot in argument order', async () => {
    const fixture = await seedBookingFixture();
    const [{ default: Seat }, { default: redisClient }, { rollbackLocksAndRows }] = await Promise.all([
        import('../../src/models/seat.model'),
        import('../../src/utils/redisClient'),
        import('../../src/controllers/order.controller'),
    ]);

    const [secondRowSeatOne, secondRowSeatTwo] = await Seat.create([
        {
            seat_number: 'B1',
            zone_id: fixture.zoneId,
            event_id: fixture.eventId,
            show_id: fixture.showId,
            status: 'available',
            row: 'B',
            col_index: 1,
            tier: 'VIP',
            ticket_type_id: fixture.ticketTypeId,
        },
        {
            seat_number: 'B2',
            zone_id: fixture.zoneId,
            event_id: fixture.eventId,
            show_id: fixture.showId,
            status: 'available',
            row: 'B',
            col_index: 2,
            tier: 'VIP',
            ticket_type_id: fixture.ticketTypeId,
        },
    ]);
    const secondRowKey = `event:${fixture.eventId}:show:${fixture.showId}:zone:${fixture.zoneId}:row:B`;
    const secondRowSeatIds = [secondRowSeatOne._id.toString(), secondRowSeatTwo._id.toString()];
    const lockedSeatIds = [fixture.seatId, ...secondRowSeatIds];

    await Promise.all([
        redisClient.set(fixture.rowKey, 'H'),
        redisClient.set(secondRowKey, 'HH'),
        redisClient.set(fixture.heldCountKeyForA, '3'),
        ...lockedSeatIds.map(seatId => redisClient.set(
            `event:${fixture.eventId}:show:${fixture.showId}:seat:${seatId}:lock`,
            fixture.attendeeAId,
        )),
    ]);

    await rollbackLocksAndRows(
        fixture.eventId,
        fixture.showId,
        fixture.zoneId,
        fixture.attendeeAId,
        lockedSeatIds,
        [
            { rowLabel: 'A', prevString: 'O' },
            { rowLabel: 'B', prevString: 'OO' },
        ],
    );

    assert.deepEqual(await Promise.all([
        redisClient.get(fixture.rowKey),
        redisClient.get(secondRowKey),
        redisClient.get(fixture.heldCountKeyForA),
        ...lockedSeatIds.map(seatId => redisClient.get(
            `event:${fixture.eventId}:show:${fixture.showId}:seat:${seatId}:lock`,
        )),
    ]), ['O', 'OO', null, null, null, null]);
});
