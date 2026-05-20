import { Request, Response } from "express";
import TicketType from "../models/ticket-type.model";
import Show from "../models/show.model";
import redisClient from "../utils/redisClient";

export const createTicketType = async (req: Request, res: Response) => {
    try {
        const event_id = req.params.event_id as string;
        const { name, price, target_tier, is_limited_promo, total_quantity, sold_quantity, sale_start, sale_end } = req.body;
        if (!name || !price || !event_id) {
            return res.status(400).json({ message: "Name, price, and event ID are required" });
        }
        const ticketType = new TicketType({ name, price, event_id, target_tier, is_limited_promo, total_quantity, sold_quantity, sale_start, sale_end });
        await ticketType.save();
        // if (capacity && zone_id) {
        //     const inventoryKey = `show:${show_id}:zone:${zone_id}:ticketType:${ticketType._id}:available`;
        //     await redisClient.set(inventoryKey, capacity.toString());
        // }
        res.status(201).json(ticketType);
    } catch (error) {
        console.error("Error creating ticket type:", error);
        res.status(500).json({ message: "Error creating ticket type", error });
    }
};

export const getTicketTypesByEvent = async (req: Request, res: Response) => {
    try {
        const { event_id, show_id } = req.params;
        const ticketTypes = await TicketType.find({ event_id, show_id });

        res.status(200).json(ticketTypes);
    } catch (error) {
        res.status(500).json({ message: "Error fetching ticket types", error });
    }
};

export const getTicketTypeById = async (req: Request, res: Response) => {
    try {
        const { ticketTypeId } = req.params;
        const ticketType = await TicketType.findById(ticketTypeId);
        if (!ticketType) {
            return res.status(404).json({ message: "Ticket type not found" });
        }
        res.status(200).json(ticketType);
    } catch (error) {
        res.status(500).json({ message: "Error fetching ticket type", error });
    }
};

export const updateTicketType = async (req: Request, res: Response) => {
    try {
        const { name, price } = req.body;
        const { ticketTypeId } = req.params;
        const ticketType = await TicketType.findByIdAndUpdate(
            ticketTypeId,
            { name, price },
            { new: true }
        );
        if (!ticketType) {
            return res.status(404).json({ message: "Ticket type not found" });
        }
        res.status(200).json(ticketType);
    } catch (error) {
        res.status(500).json({ message: "Error updating ticket type", error });
    }
};

export const deleteTicketType = async (req: Request, res: Response) => {
    try {
        const { ticketTypeId } = req.params;
        const ticketType = await TicketType.findByIdAndDelete(ticketTypeId);
        if (!ticketType) {
            return res.status(404).json({ message: "Ticket type not found" });
        }
        res.status(200).json({ message: "Ticket type deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting ticket type", error });
    };
};

export const initializeTicketInventory = async (req: Request, res: Response) => {
    try {
        const { event_id, zone_id, show_id } = req.body;
        const totalSeats = parseInt(req.body.totalSeats); // VD: 500
        await TicketType.findOneAndUpdate(
            { event_id: event_id, zone_id: zone_id, show_id: show_id },
            { total_seats: totalSeats },
            { upsert: true, new: true }
        );

        const inventoryKey = `show:${show_id}:zone:${zone_id}:available`;

        await redisClient.set(inventoryKey, totalSeats);


        res.status(200).json({
            message: "Đã nạp kho vé lên Redis thành công! Sẵn sàng mở bán.",
            zone: zone_id,
            available: totalSeats
        });

    } catch (error) {
        console.error("Lỗi khi nạp kho vé:", error);
        res.status(500).json({ error: "Lỗi hệ thống" });
    }
};