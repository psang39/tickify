import Event from "../models/event.model";
import { Request, Response } from "express";
import mongoose from "mongoose";
import Show from "../models/show.model";
import Order from "../models/order.model";
import Zone from "../models/zone.model";
import redisClient from "../utils/redisClient";
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
        const event = new Event({
            name, description, genre,
            start_date: new Date(start_date),
            end_date: new Date(end_date),
            organizer_id, poster_url, banner_url, artists,
            status: 'draft',
            banner_offset_y
        });
        await event.save();
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: "Error creating event", error });
    }
};
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
        const { event_id } = req.params;
        const organizer_id = req.user!.id;
        const { name, description, genre, start_date, end_date, poster_url, banner_url, artists, banner_offset_y } = req.body;
        const event = await Event.findOne({ _id: event_id, organizer_id });
        if (!event) return res.status(404).json({ message: "Sự kiện không tồn tại hoặc bạn không có quyền chỉnh sửa" });
        if (event.status === 'published') {
            return res.status(400).json({
                message: "Sự kiện đang công khai trên sàn bán vé. Vui lòng 'Tạm dừng sự kiện' trước khi thay đổi thông tin cấu hình."
            });
        }
        if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ message: "End date must be later than start date" });
        }
        event.name = name ?? event.name;
        event.description = description ?? event.description;
        event.genre = genre ?? event.genre;
        event.start_date = start_date ? new Date(start_date) : event.start_date;
        event.end_date = end_date ? new Date(end_date) : event.end_date;
        event.poster_url = poster_url ?? event.poster_url;
        event.banner_url = banner_url ?? event.banner_url;
        event.artists = artists ?? event.artists;
        event.banner_offset_y = banner_offset_y ?? event.banner_offset_y;
        const updatedEvent = await event.save();
        res.status(200).json({ message: "Cập nhật thông tin Sự kiện thành công", data: updatedEvent });
    } catch (error) {
        res.status(500).json({ message: "Error updating event", error });
    }
};
export const publishEvent = async (req: Request, res: Response) => {
    try {
        const { event_id } = req.params;
        const organizer_id = req.user!.id;
        const event = await Event.findOne({ _id: event_id, organizer_id });
        if (!event) return res.status(404).json({ message: "Sự kiện không tồn tại" });
        if (event.status === 'published') {
            return res.status(400).json({ message: "Sự kiện này vốn đã được công khai trước đó." });
        }
        event.status = 'published';
        await event.save();
        res.status(200).json({
            message: "Công khai Sự kiện thành công. Bạn đã có thể kích hoạt mở bán các Show diễn bên trong."
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi công khai Sự kiện", error });
    }
};
export const unpublishEvent = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { event_id } = req.params;
        const organizer_id = req.user!.id;
        const event = await Event.findOne({ _id: event_id, organizer_id });
        if (!event) return res.status(404).json({ message: "Sự kiện không tồn tại" });
        if (event.status !== 'published') {
            return res.status(400).json({ message: "Chỉ có thể tạm dừng khi sự kiện đang hiển thị Công khai." });
        }
        const hasSoldTickets = await Order.exists({
            event_id,
            status: { $in: ['completed', 'reserved'] }
        });
        if (hasSoldTickets) {
            return res.status(400).json({
                message: "Không thể hạ trạng thái Sự kiện! Một hoặc nhiều đêm diễn bên trong đã phát sinh giao dịch đặt vé thực tế."
            });
        }
        event.status = 'draft';
        await event.save({ session });
        const publishedShows = await Show.find({ event_id, status: 'published' }).select('_id');
        if (publishedShows.length > 0) {
            const showIds = publishedShows.map(s => s._id);
            await Show.updateMany({ _id: { $in: showIds } }, { status: 'draft' }, { session });
            const pipeline = redisClient.multi();
            for (const showId of showIds) {
                const zones = await Zone.find({ show_id: showId }).select('_id');
                zones.forEach(zone => {
                    const summaryKey = `event:${event_id}:show:${showId}:zone:${zone._id}:summary`;
                    pipeline.del(summaryKey);
                });
                pipeline.del(`show:${showId}:ticket_types`);
                pipeline.del(`show:${showId}:seats_static_layout`);
            }
            await pipeline.exec();
        }
        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ message: "Đã tạm dừng sự kiện và hạ toàn bộ các đêm diễn liên quan về dạng bản nháp." });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Lỗi khi unpublish event:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi tạm dừng Sự kiện", error });
    }
};
export const cancelEvent = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { event_id } = req.params;
        const organizer_id = req.user!.id;

        const event = await Event.findOne({ _id: event_id, organizer_id });
        if (!event) return res.status(404).json({ message: "Sự kiện không tồn tại" });

        if (event.status === 'cancelled') {
            return res.status(400).json({ message: "Sự kiện này vốn đã bị hủy trước đó." });
        }

        // Chuyển trạng thái Event sang hủy
        event.status = 'cancelled';
        await event.save({ session });

        // TÁC ĐỘNG DÂY CHUYỀN: Đóng băng và chuyển TẤT CẢ các show con sang 'cancelled' bất kể đang draft hay published
        const allShows = await Show.find({ event_id }).select('_id');

        if (allShows.length > 0) {
            const showIds = allShows.map(s => s._id);
            await Show.updateMany({ _id: { $in: showIds } }, { status: 'cancelled' }, { session });

            const pipeline = redisClient.multi();
            for (const showId of showIds) {
                const zones = await Zone.find({ show_id: showId }).select('_id');
                zones.forEach(zone => {
                    pipeline.del(`event:${event_id}:show:${showId}:zone:${zone._id}:summary`);
                });
            }
            await pipeline.exec();
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            message: "Hủy sự kiện thành công. Toàn bộ các đêm diễn liên quan đã bị đóng, dữ liệu hóa đơn cũ được giữ lại để đối soát hoàn tiền."
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Lỗi khi hủy sự kiện:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi hủy Sự kiện", error });
    }
};
export const deleteEvent = async (req: Request, res: Response) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        if (event.organizer_id.toString() !== req.user!.id) {
            return res.status(403).json({ message: "You do not have permission to delete this event" });
        }
        if (event.status === 'published') {
            return res.status(400).json({ message: "Cannot delete an event that is currently published. Please unpublish it first." });
        }
        const ordersExist = await Order.exists({ event_id: event._id });
        if (ordersExist) {
            return res.status(400).json({ message: "Cannot delete event with existing orders. Please contact support." });
        }
        await Event.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Event deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting event", error });
    };
};
export const getOrganizerEvents = async (req: Request, res: Response) => {
    try {
        const organizerId = (req as any).user.id;
        const { page, limit, status, search } = req.query;
        let filter: any = { organizer_id: organizerId };
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
        };
        const result = await Event.paginate(filter, options);
        res.status(200).json({
            status: "success",
            data: result.docs,
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