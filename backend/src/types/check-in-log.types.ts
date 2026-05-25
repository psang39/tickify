import { Document, Types } from 'mongoose';

export type CheckInMode = 'ONLINE' | 'OFFLINE_SYNC';
export type CheckInResult = 'SUCCESS' | 'DUPLICATE' | 'INVALID' | 'EXPIRED' | 'NOT_FOUND' | 'CONFLICT' | 'ERROR';

export interface ICheckInLog extends Document {
    ticket_id?: Types.ObjectId;
    show_id: Types.ObjectId;
    event_id: Types.ObjectId;
    staff_id: Types.ObjectId;
    organizer_id: Types.ObjectId;
    seat_id?: Types.ObjectId;
    ticket_type_id?: Types.ObjectId;
    mode: CheckInMode;
    result: CheckInResult;
    scanned_at: Date;
    synced_at?: Date;
    device_id?: string;
    note?: string;
    raw_ticket_id?: string;
}
