import Mongoose from 'mongoose';
import User from './user.model';
import { IOrganizer } from '../types/organizer.types';
const OrganizerSchema = new Mongoose.Schema<IOrganizer>({
    company_name: { type: String, required: true },
    tax_id: { type: String, required: true, unique: true },
    verified: { type: Boolean, default: false }
});

const Organizer = User.discriminator('Organizer', OrganizerSchema);

export default Organizer;