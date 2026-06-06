import { Document, Types } from "mongoose";
export interface IZone extends Document {
    _id: Types.ObjectId,
    name: string,
    venue_id: Types.ObjectId,
    event_id: Types.ObjectId,
    show_id: Types.ObjectId,
    overall_map_svg_id: string,
    x: number,
    y: number,
    color: string,
    capacity: number,
    is_standing: boolean,
    ticket_type_id?: Types.ObjectId,
    path_data: string
}