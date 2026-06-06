import Mongoose from 'mongoose';
import { ITicketType } from '../types/ticket-type.types';
const TicketTypeSchema: Mongoose.Schema = new Mongoose.Schema<ITicketType>({
    event_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    show_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    name: { type: String, required: true, min: 0 },
    target_tier: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    is_limited_promo: { type: Boolean, default: false },
    total_quantity: { type: Number, default: null },
    sold_quantity: { type: Number, default: 0 },
    sale_start: { type: Date, required: true },
    sale_end: { type: Date, required: true },
    status: {
        type: String,
        enum: ['active', 'inactive', 'sold_out'],
        default: 'active'
    }
}, { timestamps: true });

export default Mongoose.model('TicketType', TicketTypeSchema);