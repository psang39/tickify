import { Document, Types } from "mongoose";
export interface IOrder extends Document {
    order_number: string,
    _id: Types.ObjectId,
    user_id: Types.ObjectId,
    event_id: Types.ObjectId,
    show_id: Types.ObjectId,
    zone_id: Types.ObjectId,
    items: {
        seat_id: Types.ObjectId,
        ticket_type_id: Types.ObjectId,
        price: number
    }[],
    purchaser_name: string,
    purchaser_email: string,
    purchaser_phone: string,
    status: 'pending' | 'confirmed' | 'cancelled',
    total_price: number,
    created_at: Date,
    cancellation_deadline: Date,
    discount_amount: number,
    promo_code: string
}