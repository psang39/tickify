import Mongoose from 'mongoose';
import { IEvent } from '../types/event.types';
import paginate from 'mongoose-paginate-v2';
import mongoose from 'mongoose';
const EventSchema = new Mongoose.Schema<IEvent>({
    name: { type: String, required: true },
    description: { type: String },
    genre: { type: String },
    poster_url: { type: String },
    banner_url: { type: String },
    banner_offset_y: { type: Number, default: 50 },
    artists: [{ type: String }],
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    status: {
        type: String,
        enum: ['draft', 'published', 'cancelled'],
        default: 'draft'
    },
    organizer_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Organizer', required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
});
EventSchema.virtual('time_state').get(function () {
    const now = new Date();
    if (this.status === 'cancelled') return 'cancelled';
    if (now < this.start_date) return 'upcoming';
    if (now >= this.start_date && now <= this.end_date) return 'ongoing';
    return 'past';
});
EventSchema.virtual('sale_state').get(function () {
    const now = new Date();
    if (this.status === 'cancelled') return 'closed';
    if (now < this.start_date) return 'coming_soon';
    if (now >= this.start_date && now <= this.end_date) return 'on_sale';
    return 'closed';
});
EventSchema.index({ status: 1, created_at: -1 });
EventSchema.index({ status: 1, start_date: 1 });
EventSchema.index({ genre: 1, status: 1 });
EventSchema.index({ organizer_id: 1, created_at: -1 });
EventSchema.plugin(paginate);
EventSchema.set('toJSON', { virtuals: true });
EventSchema.set('toObject', { virtuals: true });
const Event = Mongoose.model<IEvent, mongoose.PaginateModel<IEvent>>('Event', EventSchema);

export default Event;