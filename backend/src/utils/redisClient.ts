import { createClient } from 'redis';
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_URL, REDIS_USERNAME } from '../config/index';

const redisUrl = REDIS_URL?.trim();
const redisHost = REDIS_HOST?.trim() || '127.0.0.1';
const redisPort = Number(REDIS_PORT || 6379);
const redisPassword = REDIS_PASSWORD?.trim() || undefined;
const redisUsername = REDIS_USERNAME?.trim() || (redisPassword ? 'default' : undefined);

const redisClient = createClient(
    redisUrl?.startsWith('redis://') || redisUrl?.startsWith('rediss://')
        ? { url: redisUrl }
        : {
            username: redisUsername,
            password: redisPassword,
            socket: {
                host: redisHost,
                port: redisPort,
                connectTimeout: 10000,
            }
        }
);

redisClient.on('error', err => console.log('Redis Client Error:', err.message));
redisClient.on('ready', () => console.log('Redis đã sẵn sàng!'));

// Hàm này sẽ được gọi ở server.ts
export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();

            await redisClient.set('connection_test', 'OK', { EX: 60 });
            const res = await redisClient.get('connection_test');
            console.log("Redis Test:", res);
        }
    } catch (err) {
        console.error("Lỗi kết nối Redis:", err);
        throw err;
    }
};

export default redisClient;
