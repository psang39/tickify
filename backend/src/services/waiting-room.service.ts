import redisClient from '../utils/redisClient';

const ALLOWED_CONCURRENT_USERS = 500;
const QUEUE_FINALIZED_TTL_SECONDS = 24 * 60 * 60;

type WaitingRoomStatus = 'WAITING_ROOM' | 'WAITING' | 'YOUR_TURN';

type JoinResult = {
    status: Extract<WaitingRoomStatus, 'WAITING_ROOM' | 'WAITING'>;
    position?: number;
    saleStarted: boolean;
};

type CheckStatusResult = {
    status: WaitingRoomStatus;
    position?: number;
    estimatedWaitTime?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shuffle = <T>(items: T[]): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

export class WaitingRoomService {
    private static getWaitingRoomKey(show_id: string): string {
        return `waiting_room:${show_id}:pre_sale`;
    }

    private static getQueueKey(show_id: string): string {
        return `waiting_room:${show_id}:queue`;
    }

    private static getFinalizedKey(show_id: string): string {
        return `waiting_room:${show_id}:queue_finalized`;
    }

    private static getFinalizeLockKey(show_id: string): string {
        return `waiting_room:${show_id}:queue_finalize_lock`;
    }

    private static async finalizeQueueIfNeeded(show_id: string, saleStartTime: number): Promise<void> {
        if (Date.now() < saleStartTime) return;

        const finalizedKey = this.getFinalizedKey(show_id);
        const alreadyFinalized = await redisClient.get(finalizedKey);
        if (alreadyFinalized) return;

        const lockKey = this.getFinalizeLockKey(show_id);
        const lockAcquired = await redisClient.set(lockKey, '1', { NX: true, EX: 10 });

        if (!lockAcquired) {
            for (let attempt = 0; attempt < 30; attempt += 1) {
                if (await redisClient.get(finalizedKey)) return;
                await sleep(100);
            }
            return;
        }

        try {
            if (await redisClient.get(finalizedKey)) return;

            const waitingRoomKey = this.getWaitingRoomKey(show_id);
            const queueKey = this.getQueueKey(show_id);
            const [waitingUsers, existingQueueUsers] = await Promise.all([
                redisClient.zRange(waitingRoomKey, 0, -1),
                redisClient.zRange(queueKey, 0, -1),
            ]);

            const existingQueueSet = new Set(existingQueueUsers.map(String));
            const randomizedUsers = shuffle(waitingUsers.map(String).filter((userId) => !existingQueueSet.has(userId)));

            if (randomizedUsers.length > 0) {
                await redisClient.zAdd(
                    queueKey,
                    randomizedUsers.map((userId, index) => ({
                        score: index + Math.random() * 0.000001,
                        value: userId,
                    })),
                    { NX: true }
                );
            }

            await redisClient.del(waitingRoomKey);
            await redisClient.setEx(finalizedKey, QUEUE_FINALIZED_TTL_SECONDS, '1');
        } finally {
            await redisClient.del(lockKey);
        }
    }

    static async joinWaitingRoom(show_id: string, user_id: string, saleStartTime: number): Promise<JoinResult> {
        const currentTime = Date.now();
        const userId = String(user_id);

        if (currentTime < saleStartTime) {
            const waitingRoomKey = this.getWaitingRoomKey(show_id);
            await redisClient.zAdd(waitingRoomKey, [{ score: currentTime, value: userId }], { NX: true });

            return {
                status: 'WAITING_ROOM',
                saleStarted: false,
            };
        }

        await this.finalizeQueueIfNeeded(show_id, saleStartTime);

        const waitingRoomKey = this.getWaitingRoomKey(show_id);
        const queueKey = this.getQueueKey(show_id);
        await redisClient.zRem(waitingRoomKey, userId);
        await redisClient.zAdd(queueKey, [{ score: currentTime + Math.random(), value: userId }], { NX: true });

        const rank = await redisClient.zRank(queueKey, userId);
        return {
            status: 'WAITING',
            position: rank !== null ? rank + 1 : 0,
            saleStarted: true,
        };
    }

    static async checkStatus(show_id: string, user_id: string, saleStartTime: number): Promise<CheckStatusResult> {
        const currentTime = Date.now();
        const userId = String(user_id);

        if (currentTime < saleStartTime) {
            const waitingRoomKey = this.getWaitingRoomKey(show_id);
            const rankInWaitingRoom = await redisClient.zRank(waitingRoomKey, userId);

            if (rankInWaitingRoom === null) {
                throw new Error('Bạn không có mặt trong phòng chờ.');
            }

            return {
                status: 'WAITING_ROOM',
                estimatedWaitTime: Math.max(1, Math.ceil((saleStartTime - currentTime) / 60000)),
            };
        }

        await this.finalizeQueueIfNeeded(show_id, saleStartTime);

        const queueKey = this.getQueueKey(show_id);
        const rank = await redisClient.zRank(queueKey, userId);

        if (rank === null) {
            throw new Error('Bạn không có mặt trong hàng đợi.');
        }

        const position = rank + 1;

        if (rank < ALLOWED_CONCURRENT_USERS) {
            return { status: 'YOUR_TURN' };
        }

        const usersAhead = position - ALLOWED_CONCURRENT_USERS;
        const estimatedWaitTime = Math.ceil(usersAhead / 100);

        return {
            status: 'WAITING',
            position,
            estimatedWaitTime,
        };
    }

    static async leaveQueue(show_id: string, user_id: string): Promise<void> {
        const userId = String(user_id);
        await Promise.all([
            redisClient.zRem(this.getWaitingRoomKey(show_id), userId),
            redisClient.zRem(this.getQueueKey(show_id), userId),
        ]);
    }
}
