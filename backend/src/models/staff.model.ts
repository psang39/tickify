import Mongoose, { Schema, Document, PaginateModel } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import User from './user.model';
import { IStaff } from '../types/staff.types';
const StaffSchema: Schema = new Mongoose.Schema<IStaff>({
    assigned_show_ids: [{ type: Mongoose.Schema.Types.ObjectId, ref: 'Show' }],
    organizer_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

StaffSchema.plugin(mongoosePaginate);
const Staff = User.discriminator('Staff', StaffSchema);
export default Staff;