import Mongoose from 'mongoose';
import { IAttendee } from '../types/attendee.types';
import User from './user.model';
const AttendeeSchema = new Mongoose.Schema<IAttendee>({
    date_of_birth: { type: Date },
    preferences: [{ type: String }]
});

const Attendee = User.discriminator('Attendee', AttendeeSchema);

export default Attendee;