import Zone from "../models/zone.model";
import Seat from "../models/seat.model";
import Show from "../models/show.model";
import { Request, Response } from "express";
import redisClient from "../utils/redisClient";
export const getSeatsByZone = async (req: Request, res: Response) => {
    try {
        const { zone_id } = req.params;
        const zone = await Zone.findById(zone_id);
        if (!zone) {
            return res.status(404).json({ message: "Zone not found" });
        }
        const seats = await Seat.find({ zone_id: zone_id });
        res.status(200).json(seats);
    } catch (error) {
        res.status(500).json({ message: "Error fetching seats", error });
    }
};
export const getShowLayoutMinified = async (req: Request, res: Response) => {
    try {
        const { show_id } = req.params;
        const seats = await Seat.find({ show_id })
            .select('x y tier_id zone_id status')
            .lean();
        res.status(200).json(seats);
    } catch (error) {
        res.status(500).json({ message: "Error", error });
    }
};
export const getSeatsByShow = async (req: Request, res: Response) => {
    try {
        const { show_id } = req.params;
        const show = await Show.findById(show_id).select('status').lean();
        if (!show) {
            return res.status(404).json({ message: "Show not found" });
        }
        if (show.status !== "published") {
            return res.status(400).json({ message: "Show is not active" });
        }
        const layoutCacheKey = `show:${show_id}:seats_static_layout`;
        const statusHashKey = `show:${show_id}:seat_status`;
        let seatsLayout: any[] = [];
        const cachedLayout = await redisClient.get(layoutCacheKey);
        if (cachedLayout) {
            seatsLayout = JSON.parse(cachedLayout);
        } else {
            seatsLayout = await Seat.find({ show_id })
                .select('_id seat_number zone_id row col_index tier x y status ticket_type_id')
                .lean();
            if (seatsLayout.length === 0) {
                return res.status(404).json({ message: "Không tìm thấy dữ liệu ghế cho show này" });
            }
            await redisClient.set(layoutCacheKey, JSON.stringify(seatsLayout), {
                EX: 86400
            });
        }
        const dynamicStatus = await redisClient.hGetAll(statusHashKey);
        const finalSeats = seatsLayout.map((seat: any) => {
            const seatIdStr = seat._id.toString();
            if (dynamicStatus[seatIdStr]) {
                return {
                    ...seat,
                    status: dynamicStatus[seatIdStr]
                };
            }
            return seat;
        });
        res.status(200).json(finalSeats);
    } catch (error) {
        console.error("Lỗi lấy dữ liệu Seatmap:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi lấy sơ đồ ghế", error });
    }
};
export const getDetailedSeatsByZone = async (req: Request, res: Response) => {
    try {
        const { zone_id } = req.params;
        const seats = await Seat.find({ zone_id })
            .sort({ row: 1, col: 1 })
            .lean();
        res.status(200).json(seats);
    } catch (error) {
        res.status(500).json({ message: "Error", error });
    }
};
export const getSeatById = async (req: Request, res: Response) => {
    try {
        const { seat_id } = req.params;
        const seat = await Seat.findById(seat_id);
        if (!seat) {
            return res.status(404).json({ message: "Seat not found" });
        }
        res.status(200).json(seat);
    } catch (error) {
        res.status(500).json({ message: "Error fetching seat", error });
    }
};
export const blockSeat = async (req: Request, res: Response) => {
    try {
        const { seat_id } = req.params;
        const updatedSeat = await Seat.findOneAndUpdate(
            { _id: seat_id, status: "available" },
            { status: "blocked" },
            { new: true }
        );
        if (!updatedSeat) {
            return res.status(400).json({
                message: "Ghế không tồn tại, hoặc đã bị khách hàng khác giữ/mua rồi!"
            });
        }
        const zone = await Zone.findById(updatedSeat.zone_id).select('show_id event_id');
        if (zone) {
            await redisClient.decrBy(`event:${zone.event_id}:zone:${zone._id}:available`, 1);
        }
        res.status(200).json({ message: "Khóa ghế thành công", seat: updatedSeat });
    } catch (error) {
        console.error("Lỗi blockSeat:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi khóa ghế" });
    }
};
export const unblockSeat = async (req: Request, res: Response) => {
    try {
        const { seat_id } = req.params;
        const updatedSeat = await Seat.findOneAndUpdate(
            { _id: seat_id, status: "blocked" },
            { status: "available" },
            { new: true }
        );
        if (!updatedSeat) {
            return res.status(400).json({ message: "Ghế không tồn tại hoặc hiện không bị khóa." });
        }
        const zone = await Zone.findById(updatedSeat.zone_id).select('show_id event_id');
        if (zone) {
            await redisClient.incrBy(`event:${zone.event_id}:zone:${zone._id}:available`, 1);
        }
        res.status(200).json({ message: "Mở khóa ghế thành công", seat: updatedSeat });
    } catch (error) {
        console.error("Lỗi unblockSeat:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi mở khóa ghế" });
    }
};
