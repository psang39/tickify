import { Types, Document } from "mongoose";

export interface ITicketValidation extends Document {
    order_id: Types.ObjectId;
    user_id: Types.ObjectId;
    event_id: Types.ObjectId;
    seat_id: Types.ObjectId;
    ticket_type_id: Types.ObjectId;
    ticket_secret: string;
    status: 'VALID' | 'USED' | 'INVALID';
    check_in_time?: Date;
}