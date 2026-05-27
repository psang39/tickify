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
            sort: { start_date: 1 }
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
        const startedAt = Date.now();
        const keyword = String(req.query.q || req.query.keyword || req.query.search || req.query.name || '').trim();
        const city = String(req.query.city || req.query.location || '').trim();
        const genre = String(req.query.genre || '').trim();
        const sort = String(req.query.sort || 'newest');
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 50);

        const findQuery: any = { status: 'published' };

        if (keyword && keyword !== 'undefined' && keyword !== 'null') {
            findQuery.$or = [
                { name: { $regex: keyword, $options: 'i' } },
                { artists: { $regex: keyword, $options: 'i' } },
                { genre: { $regex: keyword, $options: 'i' } },
            ];
        }

        if (genre && genre !== 'undefined' && genre !== 'all') {
            findQuery.genre = genre;
        }

        if (city && city !== 'undefined' && city !== 'all') {
            const matchingVenues = await Venue.find({
                city: { $regex: `^${city}$`, $options: 'i' }
            }).select('_id').lean();

            const venueIds = matchingVenues.map((v: any) => v._id);
            const matchingShows = await Show.find({ venue_id: { $in: venueIds } })
                .select('event_id')
                .lean();

            findQuery._id = {
                $in: [...new Set(matchingShows.map((s: any) => String(s.event_id || s.event)))]
            };
        }

        let sortOption: any = { created_at: -1 };
        if (sort === 'upcoming') {
            sortOption = { start_date: 1 };
        } else if (sort === 'oldest') {
            sortOption = { created_at: 1 };
        }

        // IMPORTANT:
        // Do not fetch banner_url here. Some projects store base64 images in banner_url/poster_url,
        // and pulling full image fields makes /events/search extremely slow on VPS/Atlas.
        const events = await Event.find(findQuery)
            .select('_id name genre artists poster_url start_date end_date created_at status')
            .sort(sortOption)
            .limit(limit)
            .lean();

        const eventIds = events.map((event: any) => event._id);

        const relatedShows = await Show.find({ event_id: { $in: eventIds } })
            .select('event_id venue_id start_time')
            .sort({ start_time: 1 })
            .populate({ path: 'venue_id', select: 'name city' })
            .lean();

        const showByEventId = new Map<string, any>();
        for (const show of relatedShows as any[]) {
            const eventId = String(show.event_id || show.event);
            if (!showByEventId.has(eventId)) {
                showByEventId.set(eventId, show);
            }
        }

        const toSafeImageUrl = (value?: string) => {
            if (!value) return null;
            // Avoid sending huge base64 data URIs in list/search APIs.
            // Detail page may still request the full event image separately if needed.
            if (value.startsWith('data:image')) return null;
            return value;
        };

        const formattedEvents = events.map((event: any) => {
            const matchShow = showByEventId.get(String(event._id));
            const venueInfo = matchShow?.venue_id as any;

            return {
                _id: event._id,
                name: event.name,
                genre: event.genre,
                artists: event.artists || [],
                poster_url: toSafeImageUrl(event.poster_url),
                start_date: event.start_date,
                end_date: event.end_date,
                venue_info: venueInfo ? {
                    name: venueInfo.name,
                    city: venueInfo.city,
                } : null,
            };
        });

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[searchEventsPublic] ${formattedEvents.length} events in ${Date.now() - startedAt}ms`);
        }

        return res.status(200).json({
            success: true,
            data: formattedEvents,
        });

    } catch (error) {
        console.error('[Search Events Backend Error]', error);
        return res.status(500).json({ message: "Lỗi hệ thống khi truy vấn tìm kiếm sự kiện." });
    }
};