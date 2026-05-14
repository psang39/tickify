import { Document, Types } from 'mongoose';

export interface IShow extends Document {
    _id: Types.ObjectId;
    event_id: Types.ObjectId;
    name: string;
    description?: string;
    genre?: string;
    stadium_map_svg: string;
    sale_start: Date;
    sale_end: Date;
    start_time: Date;
    end_time: Date;
    status: 'draft' | 'published' | 'cancelled';
    venue_id: Types.ObjectId;
    organizer_id: Types.ObjectId;
    created_at: Date;
    updated_at: Date;
}

