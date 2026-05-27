import { createClient } from 'redis';
import { REDIS_PASSWORD, REDIS_HOST, REDIS_PORT } from '../config/index';

const redisClient = createClient({
    username: 'default',
    password: REDIS_PASSWORD,
    socket: {
        host: REDIS_HOST,
        port: Number(REDIS_PORT),
        connectTimeout: 10000,
    }
});

redisClient.on('error', err => console.log('Redis Client Error:', err.message));
redisClient.on('ready', () => console.log('Redis Labs đã sẵn sàng!'));

// Hàm này sẽ được gọi ở server.ts
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