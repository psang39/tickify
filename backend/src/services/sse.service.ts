import { Response } from 'express';
import redisClient from '../utils/redisClient'; // Client redis chính của bạn
import { createClient } from 'redis'; // Cần tạo 1 client riêng cho Pub/Sub

// Lưu trữ các kết nối của user theo từng show_id
const clients = new Map<string, Response[]>();

// Tạo một Redis Client chuyên dụng chỉ để "Nghe" (Subscriber)
const subscriber = createClient({ url: process.env.REDIS_URL });
subscriber.connect();

// Lắng nghe tín hiệu từ các Server Node.js khác
subscriber.subscribe('SEAT_UPDATES', (message) => {
    const { show_id, seat_id, status } = JSON.parse(message);

    // Tìm tất cả user đang xem sơ đồ ghế của show_id này
    const showClients = clients.get(show_id) || [];

    // Phát loa thông báo cho toàn bộ các user đó
    showClients.forEach(res => {
        // Chuẩn format của SSE: bắt đầu bằng "data: ", kết thúc bằng "\n\n"
        res.write(`event: SEAT_UPDATES\n`);
        res.write(`data: ${JSON.stringify({ seat_id, status })}\n\n`);
    });
});

subscriber.subscribe('ZONE_SUMMARY_UPDATES', (message) => {
    try {
        const { show_id, zone_id, summary } = JSON.parse(message);
        const showClients = clients.get(show_id) || [];

        showClients.forEach(res => {
            // DÙNG NAMED EVENT: Khai báo tên sự kiện là 'ZONE_SUMMARY_UPDATE'
            res.write(`event: ZONE_SUMMARY_UPDATES\n`);
            res.write(`data: ${JSON.stringify({ zone_id, summary })}\n\n`);
        });
    } catch (err) {
        console.error("Lỗi parse ZONE_SUMMARY_UPDATES message:", err);
    }
});

export const addClient = (show_id: string, res: Response) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.write(`event: CONNECTION_ESTABLISHED\n`);
    res.write(`data: ${JSON.stringify({ message: 'SSE Connected' })}\n\n`);
    if (!clients.has(show_id)) {
        clients.set(show_id, []);
    }
    clients.get(show_id)!.push(res);

    // Khi user đóng trình duyệt hoặc chuyển trang, dọn dẹp bộ nhớ
    res.on('close', () => {
        const currentClients = clients.get(show_id) || [];
        clients.set(show_id, currentClients.filter(client => client !== res));
    });
};