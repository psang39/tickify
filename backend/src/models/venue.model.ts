import Mongoose from 'mongoose';
import { IVenue } from '../types/venue.types';
const VenueSchema = new Mongoose.Schema<IVenue>({
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    capacity: { type: Number, required: true },
    latitude: { type: Number },
    longtitude: { type: Number },
});

const Venue = Mongoose.model('Venue', VenueSchema);
export default Venue;