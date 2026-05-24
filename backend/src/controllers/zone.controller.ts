import Zone from "../models/zone.model";
import Seat from "../models/seat.model";
import Event from "../models/event.model";
import Show from "../models/show.model";
import { Request, Response } from "express";
import redisClient from "../utils/redisClient";
import cheerio from "cheerio";
import 'multer';

export const createZone = async (req: Request, res: Response) => {
    try {
        const event_id = req.params.event_id as string;
        const show_id = req.params.show_id as string;
        const { name, capacity, layout_map, is_standing } = req.body;
        if (!name || !event_id || !capacity) {
            return res.status(400).json({ message: "Name, event ID, and capacity are required" });
        }
        const existingEvent = await Event.findById(event_id);
        if (!existingEvent) {
            return res.status(404).json({ message: "Event not found" });
        }
        const existingShow = await Show.findById(show_id);
        if (!existingShow) {
            return res.status(404).json({ message: "Show not found" });
        }
        const zone = new Zone({ name, event_id, show_id, capacity, layout_map, is_standing });
        await zone.save();
        await redisClient.set(`show:${show_id}:zone:${zone._id}:available`, capacity.toString());
        res.status(201).json(zone);
    } catch (error) {
        console.error("Error creating zone:", error);
        res.status(500).json({ message: "Error creating zone", error });
    }
};



export const getZonesByEvent = async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const zones = await Zone.find({ event_id: eventId });
        res.status(200).json(zones);
    } catch (error) {
        res.status(500).json({ message: "Error fetching zones", error });
    }
};

export const getZoneById = async (req: Request, res: Response) => {
    try {
        const { zoneId } = req.params;
        const zone = await Zone.findById(zoneId);
        if (!zone) {
            return res.status(404).json({ message: "Zone not found" });
        } res.status(200).json(zone);
    } catch (error) {
        res.status(500).json({ message: "Error fetching zone", error });
    }
};

export const updateZone = async (req: Request, res: Response) => {
    try {
        const event_id = req.params.event_id as string;
        const show_id = req.params.show_id as string;
        const zone_id = req.params.zoneId as string;
        const existingEvent = await Event.findById(event_id);
        if (!existingEvent) {
            return res.status(404).json({ message: "Event not found" });
        }
        const { name, capacity, layout_map, is_standing } = req.body;
        const zone = await Zone.findByIdAndUpdate(
            req.params.zoneId,
            { name, capacity, layout_map, is_standing },
            { new: true }
        );
        if (!zone) {
            return res.status(404).json({ message: "Zone not found" });
        }
        res.status(200).json(zone);
    } catch (error) {
        res.status(500).json({ message: "Error updating zone", error });
    }
};

export const checkZoneAvailability = async (req: Request, res: Response) => {
    try {
        const { event_id, show_id, zone_id } = req.params;
        const { showId } = req.query;
        const requestedQty = parseInt(req.query.qty as string) || 1;

        // 1. Chỉ mất 0.001s để lấy con số này từ Redis
        const availableCountStr = await redisClient.get(`event:${event_id}:show:${show_id}:zone:${zone_id}:available`);
        const availableCount = typeof availableCountStr === "string" ? parseInt(availableCountStr, 10) : 0;

        // 2. Trả kết quả về cho Frontend
        if (availableCount >= requestedQty) {
            res.status(200).json({ isAvailable: true, availableCount });
        } else {
            res.status(200).json({
                isAvailable: false,
                message: `Rất tiếc, khu vực này chỉ còn lại ${availableCount} vé.`
            });
        }
    } catch (error) {
        res.status(500).json({ error: "Lỗi kiểm tra số lượng vé" });
    }
};