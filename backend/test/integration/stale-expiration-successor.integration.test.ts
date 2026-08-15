import '../setup-env';
import assert from 'node:assert/strict';
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

const runStaleExpirationAgainstSuccessor = async (
    t: test.TestContext,
    successor: 'different-user' | 'same-user',
): Promise<void> => {
    const fixture = await seedBookingFixture();
    const reservationA = await createPendingOrderForFixture(fixture, { expired: true });
    await markFixtureSeatAsHeld(fixture);

    const [{ processOrderExpiration }, { default: redisClient }] = await Promise.all([
        import('../../src/queues/orderExpiration.queue'),
        import('../../src/utils/redisClient'),
    ]);

    const staleFinalizerPaused = deferred();
    const resumeStaleFinalizer = deferred();
    const originalEval = redisClient.eval.bind(redisClient);
    let evalCallCount = 0;

    // Expiration A has already cancelled A in its uncommitted transaction and run
    // its per-row release Lua (row O, A lock deleted). Pause just before its
    // ownership-aware trailing finalizer, then let successor B obtain the row.
    (redisClient as any).eval = async (...args: any[]) => {
        evalCallCount += 1;
        if (evalCallCount !== 2) {
            return originalEval(...args);
        }
        staleFinalizerPaused.resolve();
        await resumeStaleFinalizer.promise;
        return originalEval(...args);
    };
    t.after(() => {
        (redisClient as any).eval = originalEval;
    });

    const expirationAttempt = processOrderExpiration({
        id: `expire-${reservationA._id}`,
        data: {
            order_id: reservationA._id,
            event_id: fixture.eventId,
            show_id: fixture.showId,
            zone_id: fixture.zoneId,
            seat_ids: [fixture.seatId],
        },
    } as any);

    await staleFinalizerPaused.promise;

    const successorHeaders = successor === 'different-user'
        ? authHeaders(fixture.attendeeBToken, fixture.checkoutToken)
        : authHeaders(fixture.attendeeAToken, fixture.checkoutToken);
    const holdResponse = await postJson(
        httpServer.baseUrl,
        '/api/v1/orders/hold',
        { items: [{ seat_id: fixture.seatId, ticket_type_id: fixture.ticketTypeId }] },
        successorHeaders,
    );
    assert.equal(
        holdResponse.status,
        201,
        `successor hold response=${JSON.stringify(holdResponse.body)}`,
    );
    const reservationBId = String((holdResponse.body as any).data.order_id);

    const beforeResume = await captureBookingState(fixture, [
        reservationA._id.toString(),
        reservationBId,
    ]);
    const expectedOwner = successor === 'different-user'
        ? fixture.attendeeBId
        : fixture.attendeeAId;
    assert.equal(beforeResume.rowCharacter, 'H');
    assert.equal(beforeResume.lockOwner, expectedOwner);
    assert.equal(beforeResume.heldCounts[expectedOwner], 1);
    assert.equal(beforeResume.dynamicSeatStatus, 'holding');
    assert.equal(beforeResume.inHoldingSet, true);

    resumeStaleFinalizer.resolve();
    assert.equal(await expirationAttempt, 'expired');

    const finalState = await captureBookingState(fixture, [
        reservationA._id.toString(),
        reservationBId,
    ]);
    const violations = findBookingInvariantViolations(finalState, 'reservation');
    assert.deepEqual(
        {
            successorOrder: finalState.orders.find(order => order.id === reservationBId)?.status,
            rowCharacter: finalState.rowCharacter,
            lockOwner: finalState.lockOwner,
            successorHeldCount: finalState.heldCounts[expectedOwner],
            dynamicSeatStatus: finalState.dynamicSeatStatus,
            inHoldingSet: finalState.inHoldingSet,
            availableTierCount: finalState.availableTierCount,
            validQuantities: finalState.validQuantities,
            violations,
        },
        {
            successorOrder: 'pending',
            rowCharacter: 'H',
            lockOwner: expectedOwner,
            successorHeldCount: 1,
            dynamicSeatStatus: 'holding',
            inHoldingSet: true,
            availableTierCount: 0,
            validQuantities: [],
            violations: [],
        },
        `final state=${JSON.stringify(finalState, null, 2)}`,
    );
};

test('stale expiration cleanup cannot mutate a different-user successor reservation', async (t) => {
    await runStaleExpirationAgainstSuccessor(t, 'different-user');
});

test('stale expiration cleanup cannot mutate a same-user successor reservation', async (t) => {
    await runStaleExpirationAgainstSuccessor(t, 'same-user');
});
