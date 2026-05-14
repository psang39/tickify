import { Document, Types } from "mongoose";
export interface IOrder extends Document {
    _id: Types.ObjectId,
    order_number: string,
    user_id: Types.ObjectId,
    event_id: Types.ObjectId,
    show_id: Types.ObjectId,
    zone_id: Types.ObjectId,
    items: {
        seat_id: Types.ObjectId,
        ticket_type_id: Types.ObjectId,
        price: number
    }[],
    billing_name: string,
    billing_email: string,
    billing_phone: string,
    status: 'pending' | 'confirmed' | 'cancelled',
    total_price: number,
    created_at: Date,
    cancellation_deadline: Date,
    discount_amount: number,
    promo_code: string
}