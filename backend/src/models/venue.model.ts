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



// Indexes for venue search and public event filtering by city.
VenueSchema.index({ city: 1 });
VenueSchema.index({ name: 1, city: 1 });
VenueSchema.index({ created_by: 1, createdAt: -1 });

VenueSchema.plugin(mongoosePaginate);
const Venue = Mongoose.model<IVenue, Mongoose.PaginateModel<IVenue>>('Venue', VenueSchema);
export default Venue;