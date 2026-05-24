import { Request, Response, NextFunction } from "express";
import redisClient from "../utils/redisClient";

export const cachedMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const key = `cache:${req.originalUrl || req.url}`;
    try {
        const cachedData = await redisClient.get(key);
        if (cachedData) {
            return res.status(200).json(JSON.parse(cachedData));
        }
        const originalSend = res.send.bind(res);
        res.send = (body: any) => {
            if (res.statusCode === 200) {
                redisClient.setEx(key, 3600, JSON.stringify(body));
            }
            return originalSend(body);

        };
        next();
    } catch (error) {
        console.error("Cache error:", error);
        next();
    }
};
