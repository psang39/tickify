import { Document, Types } from "mongoose";



export interface IEvent extends Document {
    _id: Types.ObjectId,
    name: string,
    description: string,
    genre: string,
    artists: string[],
    poster_url: string,
    banner_url: string,
    banner_offset_y: number,
    sale_start: Date,
    sale_end: Date,
    start_date: Date,
    end_date: Date,
    status: "draft" | "published" | "cancelled",
    organizer_id: Types.ObjectId,
    attendees: Types.ObjectId,
    staff: Types.ObjectId,
    venue_id: Types.ObjectId,
    created_at: Date,
    updated_at: Date
}