import '../setup-env';
import mongoose from 'mongoose';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitForMongoPrimary = async (): Promise<void> => {
    const deadline = Date.now() + 30_000;
    let lastError: unknown;

    while (Date.now() < deadline) {
        try {
            const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
            if (hello.isWritablePrimary || hello.ismaster) return;
        } catch (error) {
            lastError = error;
        }
        await sleep(500);
    }

    throw new Error(`MongoDB test replica set did not become primary: ${String(lastError || '')}`);
};

export const connectTestInfrastructure = async (): Promise<void> => {
    const mongoUri = process.env.URI;
    if (!mongoUri) throw new Error('URI is missing for integration tests');

    const mongoDeadline = Date.now() + 30_000;
    let mongoError: unknown;
    while (Date.now() < mongoDeadline && mongoose.connection.readyState !== 1) {
        try {
            await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2_000 });
        } catch (error) {
            mongoError = error;
            await sleep(500);
        }
    }
    if (mongoose.connection.readyState !== 1) {
        throw new Error(`Could not connect to test MongoDB: ${String(mongoError || '')}`);
    }
    await waitForMongoPrimary();

    const { default: redisClient } = await import('../../src/utils/redisClient');
    const redisDeadline = Date.now() + 30_000;
    let redisError: unknown;
    while (Date.now() < redisDeadline && !redisClient.isReady) {
        try {
            if (!redisClient.isOpen) await redisClient.connect();
            await redisClient.ping();
        } catch (error) {
            redisError = error;
            if (redisClient.isOpen) redisClient.disconnect();
            await sleep(500);
        }
    }
    if (!redisClient.isReady) {
        throw new Error(`Could not connect to test Redis: ${String(redisError || '')}`);
    }
};

export const resetTestInfrastructure = async (): Promise<void> => {
    const { orderExpirationQueue } = await import('../../src/queues/orderExpiration.queue');
    const { default: redisClient } = await import('../../src/utils/redisClient');

    await orderExpirationQueue.drain(true);
    await redisClient.flushDb();

    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
        await collection.deleteMany({});
    }
};

export const closeTestInfrastructure = async (): Promise<void> => {
    const { closeOrderExpirationInfrastructure } = await import('../../src/queues/orderExpiration.queue');
    const { default: redisClient } = await import('../../src/utils/redisClient');

    await closeOrderExpirationInfrastructure();
    if (redisClient.isOpen) await redisClient.quit();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};
