import { kafka } from '../kafka/kafka.client';
import {
    isPaymentConfirmedEvent,
    PAYMENT_EVENTS_TOPIC,
    PAYMENT_PROJECTION_GROUP,
} from '../kafka/payment-events';
import { applyPaymentConfirmedProjection } from '../services/payment-projection.service';

export const runPaymentEventsConsumer = async (
    signal: AbortSignal,
    onReady?: () => void,
): Promise<void> => {
    const consumer = kafka.consumer({
        groupId: PAYMENT_PROJECTION_GROUP,
    });

    await consumer.connect();
    await consumer.subscribe({
        topic: PAYMENT_EVENTS_TOPIC,
        fromBeginning: false,
    });

    console.log('[Kafka Consumer] Payment projection consumer connected');

    try {
        await consumer.run({
            eachMessage: async ({ message }) => {
                if (!message.value) return;

                let parsed: unknown;

                try {
                    parsed = JSON.parse(message.value.toString());
                } catch (error) {
                    console.error(
                        '[Kafka Consumer] Invalid JSON. Skipping poison message.',
                        error,
                    );
                    return;
                }

                if (!isPaymentConfirmedEvent(parsed)) {
                    console.error(
                        '[Kafka Consumer] Invalid payment event schema. Skipping.',
                        parsed,
                    );
                    return;
                }

                await applyPaymentConfirmedProjection(parsed);
            },
        });
        onReady?.();

        await new Promise<void>((resolve) => {
            if (signal.aborted) {
                resolve();
                return;
            }

            signal.addEventListener('abort', () => resolve(), { once: true });
        });
    } finally {
        await consumer.disconnect();
        console.log('[Kafka Consumer] Payment projection consumer disconnected');
    }
};
