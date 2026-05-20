import redisClient from '../utils/redisClient';

const ALLOWED_CONCURRENT_USERS = 500;

export class WaitingRoomService {

    private static getQueueKey(show_id: string): string {
        return `waiting_room:${show_id}`;
    }

    /**
     * 1. Ném User vào phòng chờ / hàng đợi
     * @param saleStartTime Thời gian mở bán (Ví dụ lấy từ DB hoặc cấu hình)
     */
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

    /**
     * 2. Kiểm tra xem đã đến lượt User chưa (Dùng cho API Polling)
     */
    static async checkStatus(show_id: string, user_id: string): Promise<{
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


        if (rank < ALLOWED_CONCURRENT_USERS) {
            return { status: 'YOUR_TURN' };
        }



        const position = rank + 1;
        const usersAhead = position - ALLOWED_CONCURRENT_USERS;
        const estimatedWaitTime = Math.ceil(usersAhead / 100);

        return {
            status: 'WAITING',
            position: position,
            estimatedWaitTime: estimatedWaitTime
        };
    }

    /**
     * 3. Xóa User khỏi phòng chờ (Sau khi họ mua xong hoặc hết thời gian)
     */
    static async leaveQueue(show_id: string, user_id: string): Promise<void> {
        const userId = String(user_id);
        const queueKey = this.getQueueKey(show_id);
        await redisClient.zRem(queueKey, userId);
    }
}