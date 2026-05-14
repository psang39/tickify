import { Document, Types } from "mongoose";
export interface ITicket extends Document {
    _id: Types.ObjectId;
    order_id: Types.ObjectId;
    user_id: Types.ObjectId;
    event_id: Types.ObjectId;
    show_id: Types.ObjectId;
    zone_id: Types.ObjectId;
    seat_id: Types.ObjectId;
    ticket_type_id: Types.ObjectId;
    ticket_secret: string;
    status: 'VALID' | 'USED' | 'INVALID';
    check_in_time?: Date;
}