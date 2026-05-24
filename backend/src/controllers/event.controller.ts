import Event from "../models/event.model";
import { Request, Response } from "express";
import mongoose from "mongoose";
import Show from "../models/show.model";
import Order from "../models/order.model";
import Zone from "../models/zone.model";
import Venue from "../models/venue.model";
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


        event.status = 'cancelled';
        await event.save({ session });


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
export const searchEventsPublic = async (req: Request, res: Response) => {
    try {

        const keyword = (req.query.q || req.query.keyword || req.query.search || req.query.name) as string;
        const city = (req.query.city || req.query.location) as string;
        const genre = req.query.genre as string;
        const sort = req.query.sort as string || 'newest';
        const limit = parseInt(req.query.limit as string) || 20;
        const findQuery: any = { status: 'published' };
        if (keyword && keyword.trim() !== '' && keyword !== 'undefined' && keyword !== 'null') {
            const cleanKeyword = keyword.trim();
            findQuery.$or = [
                { name: { $regex: cleanKeyword, $options: 'i' } },
                { description: { $regex: cleanKeyword, $options: 'i' } },
                { artists: { $regex: cleanKeyword, $options: 'i' } }
            ];
        }

        if (genre && genre.trim() !== '' && genre !== 'undefined' && genre !== 'all') {
            findQuery.genre = genre.trim();
        }

        if (city && city.trim() !== '' && city !== 'undefined' && city !== 'all') {
            const matchingVenues = await Venue.find({
                city: { $regex: `^${city.trim()}$`, $options: 'i' }
            }).select('_id');
            const venueIds = matchingVenues.map(v => v._id);
            const matchingShows = await Show.find({ venue_id: { $in: venueIds } }).select('event_id');
            const allowedEventIds = matchingShows.map((s: any) => s.event_id || s.event);
            findQuery._id = { $in: allowedEventIds };
        }

        let sortOption: any = { createdAt: -1 };
        if (sort === 'upcoming') {
            sortOption = { start_date: 1 };
        }


        const events = await Event.find(findQuery).sort(sortOption).limit(limit).lean();
        const eventIds = events.map(e => e._id);
        const relatedShows = await Show.find({ event_id: { $in: eventIds } })
            .populate('venue_id')
            .lean();
        const formattedEvents = events.map((event: any) => {

            const matchShow = relatedShows.find((s: any) =>
                String(s.event_id || s.event) === String(event._id)
            );
            const venueInfo = matchShow?.venue_id as any;
            return {
                _id: event._id,
                name: event.name,
                description: event.description,
                genre: event.genre,
                artists: event.artists,
                poster_url: event.poster_url,
                start_date: event.start_date,
                venue_info: venueInfo ? {
                    name: venueInfo.name,
                    city: venueInfo.city
                } : null
            };
        });


        return res.status(200).json({
            success: true,
            data: formattedEvents
        });

    } catch (error) {
        console.error('[Search Events Backend Error]', error);
        return res.status(500).json({ message: "Lỗi hệ thống khi truy vấn tìm kiếm sự kiện." });
    }
};