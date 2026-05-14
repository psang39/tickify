
export interface IUser extends Document {
    _id: string,
    email: string,
    password: string,
    first_name: string,
    last_name: string,
    phone: string,
    role: 'admin' | 'organizer' | 'attendee',
    created_at: string,
    updated_at: string,
    generateAccessJWT(): string;
}


