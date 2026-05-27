import Mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { IVenue } from '../types/venue.types';
const VenueSchema = new Mongoose.Schema<IVenue>({
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    capacity: { type: Number },
    latitude: { type: Number },
    longitude: { type: Number },
    is_verified: { type: Boolean, default: false },
    created_by: { type: Mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
}, { timestamps: true });

VenueSchema.plugin(mongoosePaginate);
const Venue = Mongoose.model<IVenue, Mongoose.PaginateModel<IVenue>>('Venue', VenueSchema);
export default Venue;