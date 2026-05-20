import { Document, Types } from "mongoose";
export interface ISeat extends Document {
    _id: Types.ObjectId,
    seat_number: string,
    x: number,
    y: number,
    zone_id: Types.ObjectId,
    event_id: Types.ObjectId,
    show_id: Types.ObjectId,
    status: 'available' | 'reserved' | 'sold' | 'blocked',
    row: string,
    col_index: number,
    tier: string,
    ticket_type_id: Types.ObjectId
}