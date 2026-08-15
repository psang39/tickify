import { createClient } from 'redis';
import { REDIS_PASSWORD, REDIS_HOST, REDIS_PORT } from '../config/index';

const redisClientKey = Symbol.for('tickify.redisClient');
const globalRedisClient = globalThis as typeof globalThis & {
    [redisClientKey]?: ReturnType<typeof createClient>;
};

const redisClient = globalRedisClient[redisClientKey] ?? (() => {
    const client = createClient({
        username: 'default',
        password: REDIS_PASSWORD,
        socket: {
            host: REDIS_HOST,
            port: Number(REDIS_PORT),
            connectTimeout: 10000,
        }
    });

    client.on('error', err => console.log('Redis Client Error:', err.message));
    client.on('ready', () => console.log('Redis Labs đã sẵn sàng!'));
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
