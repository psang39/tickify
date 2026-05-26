import Mongoose from 'mongoose';
import { ISeat } from '../types/seat.types';
const SeatSchema = new Mongoose.Schema<ISeat>({
    seat_number: { type: String, required: true },
    x: { type: Number },
    y: { type: Number },
    zone_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    event_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    show_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    status: { type: String, enum: ['available', 'reserved', 'sold', 'blocked'], default: 'available' },
    row: { type: String },
    col_index: { type: Number },
    tier: { type: String },
    ticket_type_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'TicketType' }
});

// Indexes for seatmap fetch, hold/rollback, check-in and row-based seat validation.
SeatSchema.index({ show_id: 1, zone_id: 1 });
SeatSchema.index({ show_id: 1, status: 1 });
SeatSchema.index({ zone_id: 1, row: 1, col_index: 1 });
SeatSchema.index({ ticket_type_id: 1 });

export default Mongoose.model('Seat', SeatSchema);