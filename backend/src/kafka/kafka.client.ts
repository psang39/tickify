import { Kafka, logLevel } from 'kafkajs';
import {
    KAFKA_BROKERS,
    KAFKA_CLIENT_ID,
} from '../config';
import { PAYMENT_EVENTS_TOPIC } from './payment-events';

const brokers = (KAFKA_BROKERS || 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

export const kafka = new Kafka({
    clientId: KAFKA_CLIENT_ID || 'tickify',
    brokers,
    logLevel: logLevel.INFO,
    retry: {
        initialRetryTime: 300,
        retries: 8,
    },
});

export const ensureKafkaTopics = async (): Promise<void> => {
    const admin = kafka.admin();

    try {
        await admin.connect();
        const existingTopics = await admin.listTopics();

        if (!existingTopics.includes(PAYMENT_EVENTS_TOPIC)) {
            await admin.createTopics({
                waitForLeaders: true,
                topics: [
                    {
                        topic: PAYMENT_EVENTS_TOPIC,
                        numPartitions: 3,
                        replicationFactor: 1,
                    },
                ],
            });
        }
    } finally {
        await admin.disconnect();
    }
};
