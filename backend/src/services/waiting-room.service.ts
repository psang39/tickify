import redisClient from '../utils/redisClient';

const ALLOWED_CONCURRENT_USERS = 500;

export class WaitingRoomService {

    private static getQueueKey(show_id: string): string {
        return `waiting_room:${show_id}`;
    }


    static async joinQueue(show_id: string, user_id: string, saleStartTime: number): Promise<number> {
        const queueKey = this.getQueueKey(show_id);
        const currentTime = Date.now();
        const userId = String(user_id);
        let score: number;

        if (currentTime < saleStartTime) {
            score = Math.random() * 1000000;
        } else {
            score = currentTime;
        }


        await redisClient.zAdd(queueKey, [{ score, value: userId }], { NX: true });


        const rank = await redisClient.zRank(queueKey, userId);
        return rank !== null ? rank + 1 : 0;
    }


    static async checkStatus(show_id: string, user_id: string, saleStartTime: number): Promise<{
        status: 'WAITING' | 'YOUR_TURN',
        position?: number,
        estimatedWaitTime?: number
    }> {
        const queueKey = this.getQueueKey(show_id);
        const userId = String(user_id);

        const rank = await redisClient.zRank(queueKey, userId);

        if (rank === null) {

            throw new Error("Bạn không có mặt trong phòng chờ.");
        }

        const position = rank + 1;
        const currentTime = Date.now();

        if (currentTime < saleStartTime) {
            return {
                status: 'WAITING',
                position,
                estimatedWaitTime: Math.max(1, Math.ceil((saleStartTime - currentTime) / 60000))
            };
        }

        if (rank < ALLOWED_CONCURRENT_USERS) {
            return { status: 'YOUR_TURN' };
        }



        const usersAhead = position - ALLOWED_CONCURRENT_USERS;
        const estimatedWaitTime = Math.ceil(usersAhead / 100);

        return {
            status: 'WAITING',
            position: position,
            estimatedWaitTime: estimatedWaitTime
        };
    }


    static async leaveQueue(show_id: string, user_id: string): Promise<void> {
        const userId = String(user_id);
        const queueKey = this.getQueueKey(show_id);
        await redisClient.zRem(queueKey, userId);
    }
}