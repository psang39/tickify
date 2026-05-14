import Zone from "../models/zone.model";
import Seat from "../models/seat.model";
import { Request, Response } from "express";
import redisClient from "../utils/redisClient";
import { addClient } from "../services/sse.service";

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
        // Chỉ lấy các trường cần thiết để vẽ, không lấy metadata nặng
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

        // Chuẩn hóa Key: Sử dụng prefix "show:" để dễ quản lý các dữ liệu tĩnh của show
        const cacheKey = `show:${show_id}:seats_static_layout`;

        // 1. Kiểm tra Redis Cache
        const cachedLayout = await redisClient.get(cacheKey);

        if (cachedLayout) {
            // Trả về dữ liệu từ Cache (đã có đủ x, y cho Konva)
            return res.status(200).json(JSON.parse(cachedLayout));
        }

        // 2. Nếu Cache Miss: Truy vấn MongoDB
        // QUAN TRỌNG: Phải thêm 'x' và 'y' vào .select() để Konva có tọa độ vẽ
        const seats = await Seat.find({ show_id })
            .select('_id seat_number zone_id row col_index tier x y status')
            .lean();

        if (seats.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy dữ liệu ghế cho show này" });
        }

        // 3. Lưu vào Redis
        // Vì đây là layout tĩnh (tọa độ không đổi), lưu 1 ngày là hợp lý
        await redisClient.set(cacheKey, JSON.stringify(seats), {
            EX: 86400 // 24 giờ
        });

        res.status(200).json(seats);
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

        // Ở đây có thể join thêm thông tin từ Redis để lấy trạng thái Realtime chính xác nhất
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
export const streamSeatUpdates = (req: Request, res: Response) => {
    const show_id = req.params.show_id as string;

    // BẮT BUỘC: Setup Header để biến API này thành một luồng Stream (Không bị đóng lại)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Gửi tín hiệu báo kết nối thành công
    res.write(`data: ${JSON.stringify({ message: 'SSE Connected' })}\n\n`);
    addClient(show_id, res);
};


export const blockSeat = async (req: Request, res: Response) => {
    try {
        const { seat_id } = req.params;

        // 1. Cập nhật Nguyên tử (Atomic Update) để chống Race Condition
        // Nó sẽ chỉ tìm đúng cái ghế có ID đó VÀ status đang là available. 
        // Nếu thằng khác vừa nẫng mất 1 mili-giây trước, câu lệnh này sẽ trả về null.
        const updatedSeat = await Seat.findOneAndUpdate(
            { _id: seat_id, status: "available" },
            { status: "blocked" },
            { new: true } // Trả về document sau khi update
        );

        if (!updatedSeat) {
            return res.status(400).json({
                message: "Ghế không tồn tại, hoặc đã bị khách hàng khác giữ/mua rồi!"
            });
        }

        // 2. Đồng bộ số lượng với Redis (CỰC KỲ QUAN TRỌNG)
        // Vì Seat chỉ lưu zone_id, ta cần tìm Zone để móc được event_id ra cập nhật Redis
        const zone = await Zone.findById(updatedSeat.zone_id).select('show_id event_id');

        if (zone) {
            // Trừ đi 1 ghế trống trong giỏ hàng của Zone trên Redis
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

        // 1. Cập nhật Nguyên tử (Atomic Update)
        const updatedSeat = await Seat.findOneAndUpdate(
            { _id: seat_id, status: "blocked" },
            { status: "available" },
            { new: true }
        );

        if (!updatedSeat) {
            return res.status(400).json({ message: "Ghế không tồn tại hoặc hiện không bị khóa." });
        }

        // 2. Hoàn trả số lượng về cho Redis
        const zone = await Zone.findById(updatedSeat.zone_id).select('show_id event_id');

        if (zone) {
            // Cộng thêm 1 ghế trống vào giỏ hàng của Zone trên Redis
            await redisClient.incrBy(`event:${zone.event_id}:zone:${zone._id}:available`, 1);
        }

        res.status(200).json({ message: "Mở khóa ghế thành công", seat: updatedSeat });
    } catch (error) {
        console.error("Lỗi unblockSeat:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi mở khóa ghế" });
    }
};

