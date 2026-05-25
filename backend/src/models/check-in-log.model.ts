import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { ICheckInLog } from '../types/check-in-log.types';

const CheckInLogSchema = new mongoose.Schema<ICheckInLog>({
    ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    show_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true, index: true },
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
    organizer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizer', required: true, index: true },
    seat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat' },
    ticket_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketType' },
    mode: { type: String, enum: ['ONLINE', 'OFFLINE_SYNC'], required: true },
    result: {
        type: String,
        enum: ['SUCCESS', 'DUPLICATE', 'INVALID', 'EXPIRED', 'NOT_FOUND', 'CONFLICT', 'ERROR'],
        required: true,
    },
    scanned_at: { type: Date, required: true, default: Date.now, index: true },
    synced_at: { type: Date },
    device_id: { type: String },
    note: { type: String },
    raw_ticket_id: { type: String },
}, { timestamps: true });

CheckInLogSchema.index({ organizer_id: 1, scanned_at: -1 });
CheckInLogSchema.index({ show_id: 1, ticket_id: 1, result: 1 });
CheckInLogSchema.plugin(mongoosePaginate);

export default mongoose.model<ICheckInLog, mongoose.PaginateModel<ICheckInLog>>('CheckInLog', CheckInLogSchema);
