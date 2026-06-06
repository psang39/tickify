import Mongoose from 'mongoose';
import { IZone } from '../types/zone.types';
const ZoneSchema = new Mongoose.Schema<IZone>({
    name: { type: String, required: true },
    event_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    show_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    overall_map_svg_id: { type: String },
    x: { type: Number },
    y: { type: Number },
    color: { type: String, default: '#3498db' },
    capacity: { type: Number, required: true },
    is_standing: { type: Boolean, default: false },
    ticket_type_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'TicketType' },
    path_data: { type: String }
});

export default Mongoose.model('Zone', ZoneSchema);