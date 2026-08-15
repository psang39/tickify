import { Partitioners, type Producer } from 'kafkajs';
import OutboxEvent from '../models/outbox-event.model';
import { kafka } from '../kafka/kafka.client';
import { PAYMENT_EVENTS_TOPIC } from '../kafka/payment-events';

const POLL_INTERVAL_MS = 500;
const STALE_LOCK_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;

const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

const claimNextEvent = async () => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);

    return OutboxEvent.findOneAndUpdate(
        {
            published_at: null,
            $or: [
                {
                    status: { $in: ['pending', 'failed'] },
                    next_attempt_at: { $lte: now },
                },
                {
                    status: 'publishing',
                    locked_at: { $lte: staleBefore },
                },
            ],
        },
        {
            $set: {
                status: 'publishing',
                locked_at: now,
            },
        },
        {
            sort: { createdAt: 1 },
            returnDocument: 'after',
        },
    );
};

const markPublished = async (id: unknown): Promise<void> => {
    await OutboxEvent.updateOne(
        { _id: id },
        {
            $set: {
                status: 'published',
                published_at: new Date(),
            },
            $unset: {
                locked_at: 1,
            },
        },
    );
};

const markFailed = async (
    id: unknown,
    currentAttempts: number,
): Promise<void> => {
    const attemptNumber = currentAttempts + 1;
    const backoffMs = Math.min(
        MAX_BACKOFF_MS,
        1000 * 2 ** Math.min(attemptNumber, 5),
    );

    await OutboxEvent.updateOne(
        { _id: id },
        {
            $set: {
                status: 'failed',
                next_attempt_at: new Date(Date.now() + backoffMs),
            },
            $unset: {
                locked_at: 1,
            },
            $inc: {
                attempts: 1,
            },
        },
    );
};

const publishEvent = async (
    producer: Producer,
    event: Awaited<ReturnType<typeof claimNextEvent>>,
): Promise<void> => {
    if (!event) return;

    try {
        await producer.send({
            topic: PAYMENT_EVENTS_TOPIC,
            messages: [
                {
                    key: event.aggregate_id,
                    value: JSON.stringify(event.payload),
                    headers: {
                        eventId: event.event_id,
                        eventType: event.event_type,
                    },
                },
            ],
        });

        await markPublished(event._id);
        console.log(`[Kafka Outbox] Published ${event.event_type} ${event.event_id}`);
    } catch (error) {
        await markFailed(event._id, event.attempts || 0);
        console.error(
            `[Kafka Outbox] Failed to publish ${event.event_id}:`,
            error,
        );
    }
};

export const runOutboxPublisher = async (
    signal: AbortSignal,
): Promise<void> => {
    const producer = kafka.producer({
        allowAutoTopicCreation: false,
        createPartitioner: Partitioners.DefaultPartitioner,
        idempotent: true,
        maxInFlightRequests: 1,
        retry: {
            retries: Number.MAX_SAFE_INTEGER,
        },
    });

    await producer.connect();
    console.log('[Kafka Outbox] Publisher connected');

    try {
        while (!signal.aborted) {
            const event = await claimNextEvent();

            if (!event) {
                await sleep(POLL_INTERVAL_MS);
                continue;
            }

            await publishEvent(producer, event);
        }
    } finally {
        await producer.disconnect();
        console.log('[Kafka Outbox] Publisher disconnected');
    }
};
