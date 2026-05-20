import { Response } from 'express';
import { createClient } from 'redis';
const clients = new Map<string, Response[]>();
const subscriber = createClient({ url: process.env.REDIS_URL });
const initSubscriber = async () => {
    try {
        await subscriber.connect();
        await subscriber.subscribe('SEAT_UPDATES', (message) => {
            const { show_id, seat_id, status } = JSON.parse(message);
            const showClients = clients.get(show_id) || [];
            showClients.forEach(res => {
                res.write(`event: SEAT_UPDATES\n`);
                res.write(`data: ${JSON.stringify({ seat_id, status })}\n\n`);
            });
        });
        await subscriber.subscribe('ZONE_SUMMARY_UPDATES', (message) => {
            try {
                const { show_id, zone_id, summary } = JSON.parse(message);
                const showClients = clients.get(show_id) || [];
                showClients.forEach(res => {
                    res.write(`event: ZONE_SUMMARY_UPDATES\n`);
                    res.write(`data: ${JSON.stringify({ zone_id, summary })}\n\n`);
                });
            } catch (err) {
                console.error("Loi parse ZONE_SUMMARY_UPDATES message:", err);
            }
        });
        console.log("Redis Subscriber dang hoat dong...");
    } catch (error) {
        console.error("Loi ket noi Redis Subscriber:", error);
    }
};
initSubscriber();
export const addClient = (res: Response, show_id: string) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.flushHeaders();
    res.write(`event: CONNECTION_ESTABLISHED\n`);
    res.write(`data: ${JSON.stringify({ message: 'SSE Connected' })}\n\n`);
    if (!clients.has(show_id)) {
        clients.set(show_id, []);
    }
    clients.get(show_id)!.push(res);
    res.on('close', () => {
        const currentClients = clients.get(show_id);
        if (currentClients) {
            const updatedClients = currentClients.filter(client => client !== res);
            if (updatedClients.length === 0) {
                clients.delete(show_id);
            } else {
                clients.set(show_id, updatedClients);
            }
        }
    });
};