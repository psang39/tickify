import { IUser } from "./user.types";

export interface IAttendee extends IUser {
    date_of_birth: Date,
    preferences: string[]
}

