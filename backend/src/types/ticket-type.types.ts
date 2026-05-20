import { Document, Types } from "mongoose";
export interface ITicketType extends Document {
    _id: Types.ObjectId,
    name: string,
    price: number,
    target_tier: string,
    is_limited_promo: boolean,
    total_quantity: number,
    sold_quantity: number,
    description: { type: String },
    status: 'active' | 'inactive' | 'sold_out',
    event_id: Types.ObjectId,
    show_id: Types.ObjectId,
    sale_start: Date,
    sale_end: Date,
}