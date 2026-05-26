import Mongoose from 'mongoose';
import { IZone } from '../types/zone.types';
const ZoneSchema = new Mongoose.Schema<IZone>({
    name: { type: String, required: true },
    event_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    show_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    overall_map_svg_id: { type: String }, // ID của phần tử SVG đại diện cho Zone trên bản đồ tổng
    x: { type: Number },
    y: { type: Number },
    color: { type: String, default: '#3498db' }, // Màu sắc đại diện cho Zone
    capacity: { type: Number, required: true },
    is_standing: { type: Boolean, default: false },
    ticket_type_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'TicketType' },
    path_data: { type: String } // URL or path to the layout map image
});

// Indexes for show detail, Redis summary rebuild and standing/GA ticket lookup.
ZoneSchema.index({ show_id: 1 });
ZoneSchema.index({ event_id: 1, show_id: 1 });
ZoneSchema.index({ ticket_type_id: 1 });

export default Mongoose.model('Zone', ZoneSchema);