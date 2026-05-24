import { Document, Types } from "mongoose";
export interface IVenue extends Document {
    _id: Types.ObjectId,
    name: string,
    address: string,
    capacity: number,
    city: string,
    latitude?: number,
    longitude?: number,
    is_verified: boolean,
    created_by?: Types.ObjectId
}