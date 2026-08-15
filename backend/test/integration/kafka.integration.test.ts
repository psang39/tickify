import '../setup-env';
import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import {
    closeTestInfrastructure,
    connectTestInfrastructure,
    resetTestInfrastructure,
} from '../helpers/infrastructure.helper';
import {
    markFixtureSeatAsHeld,
    seedBookingFixture,
} from '../helpers/booking.fixture';
import { ensureKafkaTopics } from '../../src/kafka/kafka.client';
import { createPaymentConfirmedEvent } from '../../src/kafka/payment-events';
import OutboxEvent from '../../src/models/outbox-event.model';
import redisClient from '../../src/utils/redisClient';
import { runOutboxPublisher } from '../../src/workers/outbox-publisher.worker';
import { runPaymentEventsConsumer } from '../../src/consumers/payment-events.consumer';

const TIMEOUT_MS = 20_000;

const waitFor = async (
    description: string,
    predicate: () => Promise<boolean>,
): Promise<void> => {
    const deadline = Date.now() + TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (await predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timed out waiting for ${description}`);
};

let abortController: AbortController | undefined;
let consumerFailure: unknown;
let publisherFailure: unknown;
let consumerReady = false;
let consumerTask: Promise<void> | undefined;
let publisherTask: Promise<void> | undefined;

before(async () => {
    await connectTestInfrastructure();
    await ensureKafkaTopics();
});

beforeEach(async () => {
    await resetTestInfrastructure();
    consumerFailure = undefined;
    publisherFailure = undefined;
    consumerReady = false;
});

after(async () => {
    abortController?.abort();
    await Promise.all([consumerTask, publisherTask].filter(Boolean));

    try {
        if (consumerFailure) throw consumerFailure;
        if (publisherFailure) throw publisherFailure;
    } finally {
        await closeTestInfrastructure();
    }
});

test('outbox payment event is published, consumed and projected', async () => {
    const fixture = await seedBookingFixture();
    await markFixtureSeatAsHeld(fixture);

    abortController = new AbortController();
    consumerTask = runPaymentEventsConsumer(
        abortController.signal,
        () => {
            consumerReady = true;
        },
    ).catch(error => {
        consumerFailure = error;
    });

    await waitFor('Kafka payment consumer to join its group', async () => {
        if (consumerFailure) throw consumerFailure;
        return consumerReady;
    });

    const paymentEvent = createPaymentConfirmedEvent({
        orderId: 'kafka-integration-order',
        transactionId: 'kafka-integration-transaction',
        eventId: fixture.eventId,
        showId: fixture.showId,
        userId: fixture.attendeeAId,
        seatIds: [fixture.seatId],
        amount: fixture.price,
    });

    await OutboxEvent.create({
        event_id: paymentEvent.eventId,
        aggregate_id: paymentEvent.data.orderId,
        event_type: paymentEvent.type,
        payload: paymentEvent,
        status: 'pending',
        attempts: 0,
        next_attempt_at: new Date(),
    });

    publisherTask = runOutboxPublisher(abortController.signal).catch(error => {
        publisherFailure = error;
    });

    await waitFor('Kafka payment projection', async () => {
        if (consumerFailure) throw consumerFailure;
        if (publisherFailure) throw publisherFailure;

        const outboxEvent = await OutboxEvent.findOne({
            event_id: paymentEvent.eventId,
        }).lean();
        const revenue = Number(await redisClient.get(
            `event:${fixture.eventId}:show:${fixture.showId}:total_revenue`,
        ));
        const soldCount = Number(await redisClient.get(
            `event:${fixture.eventId}:show:${fixture.showId}:sold_count`,
        ));

        return outboxEvent?.status === 'published'
            && revenue === fixture.price
            && soldCount === 1;
    });

    assert.equal(await redisClient.get(fixture.rowKey), 'S');
    assert.equal(await redisClient.hGet(fixture.statusHashKey, fixture.seatId), 'sold');
    assert.equal(await redisClient.get(fixture.seatLockKey), null);
    assert.equal(await redisClient.sIsMember(fixture.holdingSetKey, fixture.seatId), 0);
    assert.equal(Number(await redisClient.get(fixture.heldCountKeyForA)), 0);
});
