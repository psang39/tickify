import { Document, Types } from "mongoose";
export interface IZone extends Document {
    _id: Types.ObjectId,
    name: string,
    venue_id: Types.ObjectId,
    event_id: Types.ObjectId,
    show_id: Types.ObjectId,
    ticket_type_ids: Types.ObjectId[],
    overall_map_svg_id: string, // ID của phần tử SVG đại diện cho Zone trên bản đồ tổng
    color: string, // Màu sắc đại diện cho Zone
    capacity: number,
    is_standing: boolean,
    layout_map: string // URL or path to the layout map image
}