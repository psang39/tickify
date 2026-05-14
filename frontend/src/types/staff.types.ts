import { IUser } from "./user.types";
import { Types } from "mongoose";

export interface IStaff extends IUser {
    staff_code: string,
    assigned_event_id: Types.ObjectId[]
}   