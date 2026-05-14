import { Document, Types } from "mongoose";
export interface ITicketType extends Document {
    _id: Types.ObjectId,
    name: string,
    price: number,
    total_quantity: number,
    sold_quantity: number,
    event_id: Types.ObjectId,
    show_id: Types.ObjectId,
    zone_id: Types.ObjectId,
    sale_start: Date,
    sale_end: Date,
}