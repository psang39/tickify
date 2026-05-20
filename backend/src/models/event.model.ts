import Mongoose from 'mongoose';
import { IEvent } from '../types/event.types';
import paginate from 'mongoose-paginate-v2';
import mongoose from 'mongoose';
const EventSchema = new Mongoose.Schema<IEvent>({
    name: { type: String, required: true },
    description: { type: String },
    genre: { type: String },
    poster_url: { type: String }, // Ảnh dọc (Thumbnail)
    banner_url: { type: String }, // Ảnh ngang to (Cover)
    banner_offset_y: { type: Number, default: 50 },
    artists: [{ type: String }], // ["HIEUTHUHAI", "Rhyder", ...]
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'draft' },
    organizer_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Organizer', required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

EventSchema.plugin(paginate);

const Event = Mongoose.model<IEvent, mongoose.PaginateModel<IEvent>>('Event', EventSchema);

export default Event;