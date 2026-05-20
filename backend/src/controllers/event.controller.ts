import Event from "../models/event.model";
import { Request, Response } from "express";

export const createEvent = async (req: Request, res: Response) => {
    try {
        const { name, description, genre, start_date, end_date, poster_url, banner_url, artists, status, banner_offset_y } = req.body;
        const organizer_id = req.user!.id;
        if (!name || !description || !genre || !start_date || !end_date || !organizer_id) {
            return res.status(400).json({ message: "All fields are required" });
        }
        if (start_date > end_date) {
            return res.status(400).json({ message: "End date must be later than start date" })
        }
        const event = new Event({ name, description, genre, start_date, end_date, organizer_id, poster_url, banner_url, artists, status, banner_offset_y });
        await event.save();
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: "Error creating event", error });
    }
};

// export const getEvents = async (req: Request, res: Response) => {
//     try {
//         const events = await Event.find();
//         res.status(200).json(events);
//     } catch (error) {
//         res.status(500).json({ message: "Error fetching events", error });
//     }
// };

export const getEvents = async (req: Request, res: Response) => {
    try {
        const { status, genre, page } = req.query;
        let filter: any = {};
        if (status === "upcoming") {
            filter.date = { $gt: new Date() };
        }
        else if (status === "ongoing") {
            filter.date = { $lte: new Date(), $gte: new Date() };
        }
        else if (status === "past") {
            filter.date = { $lt: new Date() };
        }
        if (genre) {
            filter.genre = genre;
        }
        const options = {
            page: parseInt(page as string) || 1,
            limit: 10,
            sort: { date: 1 }
        };
        const events = await Event.paginate(filter, options);
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ message: "Error fetching events", error });
    }
};

export const getEventById = async (req: Request, res: Response) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        res.status(200).json(event);
    } catch (error) {
        res.status(500).json({ message: "Error fetching event", error });
    }
};

export const updateEvent = async (req: Request, res: Response) => {
    try {
        const { name, description, date, venue, genre, start_date, end_date, organizer_id, banner_offset_y } = req.body;
        const event = await Event.findByIdAndUpdate(
            req.params.id,
            { name, description, date, venue, genre, start_date, end_date, organizer_id, banner_offset_y },
            { new: true }
        );
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        res.status(200).json(event);
    } catch (error) {
        res.status(500).json({ message: "Error updating event", error });
    }
};

export const deleteEvent = async (req: Request, res: Response) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        res.status(200).json({ message: "Event deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting event", error });
    };
};


// export const publishEvent = async (req: Request, res: Response) => {
//     try {
//         const event_id = req.params.event_id as string;

//         // 1. Tìm Show
//         const event = Event.findById(event_id);
//         if (!event) return res.status(404).json({ message: "Event không tồn tại" });


//         // 2. Validate: Chống Publish 2 lần
//         if (event.status === 'published') {
//             return res.status(400).json({ message: "Show này đã được publish rồi!" });
//         }

//         const seatCount = await Seat.countDocuments({ show_id });
//         if (seatCount === 0) {
//             return res.status(400).json({
//                 message: "Không thể Publish! Vui lòng generate ghế cho các Zone trước."
//             });
//         }

//         // 4. Cập nhật trạng thái trong Database
//         show.status = 'published';
//         await show.save();


//         try {
//             await warmUpSeatmapCache(show_id);
//         } catch (cacheError) {
//             show.status = 'draft';
//             await show.save();
//             throw new Error("Lỗi nạp Cache Redis, đã hạ Show về lại bản Draft.");
//         }

//         res.status(200).json({
//             message: "Publish Show thành công! Hệ thống đã sẵn sàng đón tải.",
//             seat_cached: seatCount
//         });

//     } catch (error) {
//         console.error("Lỗi khi publish show:", error);
//         res.status(500).json({ message: "Lỗi Server", error: error.message });
//     }
// };

// export const getOrganizerEvents = async (req: Request, res: Response) => {
//     try {
//         const organizerId = (req as any).user.id;

//         const page = parseInt(req.query.page as string) || 1;
//         const limit = parseInt(req.query.limit as string) || 10;
//         const skip = (page - 1) * limit;
//         const events = await Event.find({ organizer_id: organizerId })
//             .sort({ createdAt: -1 })
//             .skip(skip)
//             .limit(limit);
//         const total = await Event.countDocuments({ organizer_id: organizerId });

//         res.status(200).json({
//             status: "success",
//             data: events,
//             pagination: {
//                 totalElements: total,
//                 totalPages: Math.ceil(total / limit),
//                 currentPage: page,
//                 limit: limit
//             }
//         });
//     } catch (error) {
//         console.error("Lỗi lấy danh sách sự kiện Organizer:", error);
//         res.status(500).json({ message: "Lỗi hệ thống khi lấy dữ liệu" });
//     }
// };

export const getOrganizerEvents = async (req: Request, res: Response) => {
    try {
        // 1. Lấy organizer_id từ token (đã qua middleware Verify)
        const organizerId = (req as any).user.id;

        // 2. Lấy các params lọc và phân trang từ query
        const { page, limit, status, search } = req.query;

        // 3. Xây dựng filter
        let filter: any = { organizer_id: organizerId };

        // Lọc theo trạng thái (draft, published, etc.) nếu có
        if (status) {
            filter.status = status;
        }

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const options = {
            page: parseInt(page as string) || 1,
            limit: parseInt(limit as string) || 10,
            sort: { createdAt: -1 },
            // customLabels: giúp bạn đổi tên field trả về cho đẹp nếu muốn
        };

        // 4. Thực hiện query phân trang
        const result = await Event.paginate(filter, options);

        // 5. Trả về data kèm thông tin phân trang chuẩn của mongoose-paginate
        res.status(200).json({
            status: "success",
            data: result.docs, // Danh sách events
            pagination: {
                totalElements: result.totalDocs,
                totalPages: result.totalPages,
                currentPage: result.page,
                limit: result.limit,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage
            }
        });
    } catch (error) {
        res.status(500).json({
            message: "Error fetching organizer events",
            error: error instanceof Error ? error.message : error
        });
    }
};

export const getOrganizerEventById = async (req: Request, res: Response) => {
    try {
        const { event_id } = req.params;
        const organizerId = (req as any).user.id;

        // Tìm event thỏa mãn 2 điều kiện: Đúng ID và thuộc về đúng Organizer này
        const event = await Event.findOne({ _id: event_id, organizer_id: organizerId });

        if (!event) {
            return res.status(404).json({
                message: "Không tìm thấy sự kiện hoặc bạn không có quyền truy cập."
            });
        }

        res.status(200).json(event);
    } catch (error) {
        res.status(500).json({ message: "Error fetching event detail", error });
    }
};