import { Document, Types } from 'mongoose';

export interface IUser extends Document {
    _id: Types.ObjectId,
    email: string,
    password: string,
    first_name: string,
    last_name: string,
    phone: string,
    role: 'Admin' | 'Organizer' | 'Attendee',
    created_at: Date,
    updated_at: Date,
    generateAccessJWT(): string;
}


