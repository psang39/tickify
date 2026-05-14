import mongoose from "mongoose";
import { ITicket } from "../types/ticket.types";
const TicketSchema = new mongoose.Schema<ITicket>({
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    show_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    zone_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    seat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', required: true },
    ticket_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketType', required: true },
    ticket_secret: { type: String, required: true },
    status: {
        type: String,
        enum: ['VALID', 'USED', 'INVALID'],
        default: 'VALID'
    },
    check_in_time: { type: Date }
}, { timestamps: true });

TicketSchema.index({ event_id: 1, seat_id: 1 }, { unique: true });
export default mongoose.model('Ticket', TicketSchema);