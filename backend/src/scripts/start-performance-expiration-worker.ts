import mongoose from 'mongoose';
import connectDB from '../config/db';
import { connectRedis } from '../utils/redisClient';
import {
    closeOrderExpirationInfrastructure,
    startOrderExpirationWorker,
} from '../queues/orderExpiration.queue';

if (process.env.NODE_ENV !== 'performance' || process.env.PERFORMANCE_QUEUE_ISOLATION !== 'true') {
    throw new Error('The standalone expiration worker is restricted to isolated performance runs.');
}

const shutdown = async () => {
    await closeOrderExpirationInfrastructure();
    await mongoose.disconnect();
    process.exit(0);
};

const bootstrap = async () => {
    await connectDB();
    await connectRedis();
    startOrderExpirationWorker();
    console.log('[performance-expiration-worker] Ready.');
};

process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });

bootstrap().catch(error => {
    console.error(error);
    process.exit(1);
});
