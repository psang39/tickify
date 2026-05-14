import Mongoose, { Schema, Document } from 'mongoose';
import User from './user.model';
import { IStaff } from '../types/staff.types';
const StaffSchema: Schema = new Mongoose.Schema<IStaff>({
    staff_code: { type: String, required: true, unique: true },
    assigned_event_id: [{ type: Mongoose.Schema.Types.ObjectId, ref: 'Event' }]
});

const Staff = User.discriminator('Staff', StaffSchema);

export default Staff;