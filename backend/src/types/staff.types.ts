import { IUser } from "./user.types";
import { Types } from "mongoose";

export interface IStaff extends IUser {
    assigned_show_ids: Types.ObjectId[],
    organizer_id: Types.ObjectId,
}
