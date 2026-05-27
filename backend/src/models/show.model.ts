import { IShow } from '../types/show.types';
import mongoose from 'mongoose';
import paginate from 'mongoose-paginate-v2';

const ShowSchema = new mongoose.Schema<IShow>({
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    name: { type: String, required: true },
    description: { type: String },
    sale_start: { type: Date, required: true },
    sale_end: { type: Date, required: true },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    stadium_map_svg: { type: String },
    map_assets: [{
        asset_id: String,     // VD: "asset_stage"
        path_data: String,    // Chuỗi d="..." để Konva vẽ
    }],
    status: { type: String, enum: ['draft', 'published', 'cancelled'], default: 'draft' },
    venue_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
    organizer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizer', required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    seatmap_status: {
        type: String,
        enum: ['none', 'processing', 'ready', 'failed'],
        default: 'none'
    },
    seatmap_error: {
        type: String,
        default: null
    },
    public_key: { type: String, required: true, unique: true },
    encrypted_private_key: { type: String, required: true, unique: true }
});

ShowSchema.plugin(paginate);
ShowSchema.virtual('time_state').get(function () {
    const now = new Date();
    if (this.status === 'cancelled') return 'cancelled';
    if (now < this.start_time) return 'upcoming';
    if (now >= this.start_time && now <= this.end_time) return 'ongoing';
    return 'past';
});
ShowSchema.virtual('sale_state').get(function () {
    const now = new Date();
    if (now < this.sale_start) return 'coming_soon'; // Đang đếm ngược
    if (now >= this.sale_start && now <= this.sale_end) return 'on_sale'; // Đang mở bán
    return 'closed';
});
ShowSchema.set('toJSON', { virtuals: true });
ShowSchema.set('toObject', { virtuals: true });

const Show = mongoose.model<IShow, mongoose.PaginateModel<IShow>>('Show', ShowSchema);
export default Show;