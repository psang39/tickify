import Attendee from "../models/attendee.model";
import { Request, Response } from "express";
import Order from "../models/order.model";
import Ticket from "../models/ticket.model";

export const getAttendeeProfile = async (req: Request, res: Response) => {
    try {
        const user_id = req.user!.id;
        const attendee = await Attendee.findById(user_id).select('-password');
        if (!attendee) {
            return res.status(404).json({ message: 'Attendee not found' });
        }
        res.status(200).json({ attendee });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching attendee profile', error });
    }
};
export const updateAttendeeProfile = async (req: Request, res: Response) => {
    try {
        const user_id = req.user!.id;
        const { first_name, last_name, email, phone } = req.body;
        const attendee = await Attendee.findByIdAndUpdate(
            user_id,
            { first_name, last_name, email, phone },
            { new: true, runValidators: true }
        ).select('-password');
        if (!attendee) {
            return res.status(404).json({ message: 'Attendee not found' });
        }
        res.status(200).json({ attendee });
    } catch (error) {
        res.status(500).json({ message: 'Error updating attendee profile', error });
    }
};



