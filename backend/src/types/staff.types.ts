import { IUser } from "./user.types";
import { Types } from "mongoose";

export interface IStaff extends IUser {
    assigned_show_ids: Types.ObjectId[],
    organizer_id: { type: Types.ObjectId, ref: 'User', required: true },
}   