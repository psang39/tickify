import Mongoose from 'mongoose';
import { ITicketType } from '../types/ticket-type.types';
const TicketTypeSchema: Mongoose.Schema = new Mongoose.Schema<ITicketType>({
    event_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    show_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    name: { type: String, required: true, min: 0 },
    target_tier: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    is_limited_promo: { type: Boolean, default: false }, // Đánh dấu đây có phải vé giới hạn không
    total_quantity: { type: Number, default: null },     // Khuyến khích để null nếu phụ thuộc vào ghế
    sold_quantity: { type: Number, default: 0 },
    sale_start: { type: Date, required: true },
    sale_end: { type: Date, required: true },
    status: {
        type: String,
        enum: ['active', 'inactive', 'sold_out'],
        default: 'active'
    }
}, { timestamps: true });

// Indexes for ticket type list, price filter and zone/tier lookup.
TicketTypeSchema.index({ show_id: 1, price: 1, name: 1 });
TicketTypeSchema.index({ event_id: 1, show_id: 1 });
TicketTypeSchema.index({ show_id: 1, target_tier: 1 });

export default Mongoose.model('TicketType', TicketTypeSchema);