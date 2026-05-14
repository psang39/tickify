import {Document, Types} from "mongoose";

export interface IOrderItem extends Document {
        order_id: Types.ObjectId,
        seat_id: Types.ObjectId,
        price: number,
        quantity: number,
        ticket_type: string
}