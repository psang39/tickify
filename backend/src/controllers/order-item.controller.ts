import { Request, Response } from "express";
import OrderItem from "../models/order-item.model";
import TicketType from "../models/ticket-type.model";
import Seat from "../models/seat.model";
export const createOrderItem = async (req: Request, res: Response) => {
    try {
        const { order_id, ticket_type_id, seat_id } = req.body;
        if (!order_id || !ticket_type_id || !seat_id) {
            return res.status(400).json({ message: "Order ID, ticket type ID, and seat ID are required" });
        }
        const ticketType = await TicketType.findById(ticket_type_id);
        if (!ticketType) {
            return res.status(404).json({ message: "Ticket type not found" });
        }
        const seat = await Seat.findById(seat_id);
        if (!seat) {
            return res.status(404).json({ message: "Seat not found" });
        }

        const orderItem = new OrderItem({ order_id, ticket_type_id, seat_id });
        await orderItem.save();
        res.status(201).json(orderItem);
    } catch (error) {
        res.status(500).json({ message: "Error creating order item", error });
    }
};
