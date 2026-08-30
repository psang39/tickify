import { createClient } from 'redis';
import { REDIS_URL } from '../config/index';

const redisClientKey = Symbol.for('tickify.redisClient');
const globalRedisClient = globalThis as typeof globalThis & {
    [redisClientKey]?: ReturnType<typeof createClient>;
};
const redisUrl = REDIS_URL || 'redis://127.0.0.1:6379';
const redisClient = globalRedisClient[redisClientKey] ?? (() => {
    const client = createClient({
        url: redisUrl,
        socket: {
            connectTimeout: 10000,
            ...(redisUrl.startsWith('rediss://')
                ? { rejectUnauthorized: false }
                : {}),
        },
    });

    client.on('error', err =>
        console.log('Redis Client Error:', err.message)
    );

    client.on('ready', () =>
        console.log('Redis is ready!')
    );

    globalRedisClient[redisClientKey] = client;
    return client;
})();

export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();

            await redisClient.set('connection_test', 'OK');
            const res = await redisClient.get('connection_test');
            console.log("Redis Test:", res);

        }
    } catch (err) {
        console.error("Lỗi kết nối Redis Labs:", err);
    }
};

export default redisClient;
