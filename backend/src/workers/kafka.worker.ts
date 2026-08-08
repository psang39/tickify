import connectDB from '../config/db';
import { connectRedis } from '../utils/redisClient';
import { ensureKafkaTopics } from '../kafka/kafka.client';
import { runOutboxPublisher } from './outbox-publisher.worker';
import { runPaymentEventsConsumer } from '../consumers/payment-events.consumer';

const abortController = new AbortController();

const requestShutdown = (signalName: string) => {
    console.log(`[Kafka Worker] Received ${signalName}; shutting down...`);
    abortController.abort();
};

process.once('SIGINT', () => requestShutdown('SIGINT'));
process.once('SIGTERM', () => requestShutdown('SIGTERM'));

const bootstrap = async (): Promise<void> => {
    await connectDB();
    await connectRedis();
    await ensureKafkaTopics();

    console.log('[Kafka Worker] Infrastructure ready');

    await Promise.all([
        runOutboxPublisher(abortController.signal),
        runPaymentEventsConsumer(abortController.signal),
    ]);
};

bootstrap().catch((error) => {
    console.error('[Kafka Worker] Fatal error:', error);
    process.exitCode = 1;
});
