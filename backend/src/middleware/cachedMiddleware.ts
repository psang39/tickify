import { Request, Response, NextFunction } from "express";
import redisClient from "../utils/redisClient";

const normalizeCachedJsonPayload = (cachedData: string) => {
    try {
        const parsed = JSON.parse(cachedData);

        // Backward compatibility for old cache entries that were saved as
        // JSON.stringify(body) while body was already a JSON string.
        // Example in Redis: "{\"_id\":\"...\"}".
        if (typeof parsed === "string") {
            const trimmed = parsed.trim();
            if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                return trimmed;
            }
        }
    } catch (_error) {
        // cachedData is already the raw JSON response body.
    }

    return cachedData;
};

export const cachedMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const key = `cache:${req.originalUrl || req.url}`;
    try {
        const cachedData = await redisClient.get(key);
        if (cachedData) {
            return res
                .status(200)
                .type("application/json")
                .set("X-Cache", "HIT")
                .send(normalizeCachedJsonPayload(cachedData));
        }

        const originalSend = res.send.bind(res);
        res.send = (body: any) => {
            if (res.statusCode === 200) {
                const payload = typeof body === "string" ? body : JSON.stringify(body);
                redisClient.setEx(key, 3600, payload).catch((error) => {
                    console.error("Cache set error:", error);
                });
            }
            return originalSend(body);
        };

        next();
    } catch (error) {
        console.error("Cache error:", error);
        next();
    }
};
