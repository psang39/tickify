import { computeShowAvailability } from '../utils/showAvailability';
import Event from "../models/event.model";
import { Request, Response } from "express";
import mongoose from "mongoose";
import Show from "../models/show.model";
import Order from "../models/order.model";
import Zone from "../models/zone.model";
import Venue from "../models/venue.model";
import redisClient from "../utils/redisClient";
import { deleteLocalUploadedImage, getUploadedEventImageUrl } from '../utils/eventImageUpload';

const getEventImageFiles = (req: Request) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    return {
        posterFile: files?.poster?.[0],
        bannerFile: files?.banner?.[0],
    };
};

const parseArtists = (artists: unknown): string[] => {
    if (Array.isArray(artists)) return artists.map(String).map(v => v.trim()).filter(Boolean);
    if (typeof artists !== 'string') return [];

    const trimmed = artists.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).map(v => v.trim()).filter(Boolean);
    } catch (_error) {
        // Fallback comma-separated input from older forms.
    }

    return trimmed.split(',').map(v => v.trim()).filter(Boolean);
};

const isBase64Image = (value?: string) => Boolean(value?.startsWith('data:image'));
const toSafeListImage = (value?: string) => isBase64Image(value) ? undefined : value;

export const createEvent = async (req: Request, res: Response) => {
    try {
        const { name, description, genre, start_date, end_date, status, banner_offset_y } = req.body;
        const organizer_id = req.user!.id;
        const { posterFile, bannerFile } = getEventImageFiles(req);

        if (!name || !description || !genre || !start_date || !end_date || !organizer_id) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return res.status(400).json({ message: "Invalid event dates" });
        }
        if (startDate > endDate) {
            return res.status(400).json({ message: "End date must be later than start date" });
        }

        if (isBase64Image(req.body.poster_url) || isBase64Image(req.body.banner_url)) {
            return res.status(400).json({ message: "Vui lòng upload ảnh bằng file, không gửi ảnh base64 trong JSON." });
        }

        const poster_url = getUploadedEventImageUrl(req, posterFile) || req.body.poster_url || '';
        const banner_url = getUploadedEventImageUrl(req, bannerFile) || req.body.banner_url || '';

        const event = new Event({
            name,
            description,
            genre,
            start_date: startDate,
            end_date: endDate,
            organizer_id,
            poster_url,
            banner_url,
            artists: parseArtists(req.body.artists),
            status: status || 'draft',
            banner_offset_y: Number(banner_offset_y ?? 50),
        });

        await event.save();
        res.status(201).json(event);
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Error creating event", error });
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
        const { name, description, genre, start_date, end_date, banner_offset_y } = req.body;
        const { posterFile, bannerFile } = getEventImageFiles(req);

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

        if (isBase64Image(req.body.poster_url) || isBase64Image(req.body.banner_url)) {
            return res.status(400).json({ message: "Vui lòng upload ảnh bằng file, không gửi ảnh base64 trong JSON." });
        }

        const oldPosterUrl = event.poster_url;
        const oldBannerUrl = event.banner_url;
        const nextPosterUrl = getUploadedEventImageUrl(req, posterFile);
        const nextBannerUrl = getUploadedEventImageUrl(req, bannerFile);

        event.name = name ?? event.name;
        event.description = description ?? event.description;
        event.genre = genre ?? event.genre;
        event.start_date = start_date ? new Date(start_date) : event.start_date;
        event.end_date = end_date ? new Date(end_date) : event.end_date;
        event.artists = req.body.artists !== undefined ? parseArtists(req.body.artists) as any : event.artists;
        event.banner_offset_y = banner_offset_y !== undefined ? Number(banner_offset_y) : event.banner_offset_y;

        if (nextPosterUrl) event.poster_url = nextPosterUrl;
        else if (req.body.poster_url !== undefined && !isBase64Image(req.body.poster_url)) event.poster_url = req.body.poster_url;

        if (nextBannerUrl) event.banner_url = nextBannerUrl;
        else if (req.body.banner_url !== undefined && !isBase64Image(req.body.banner_url)) event.banner_url = req.body.banner_url;

        const updatedEvent = await event.save();

        if (nextPosterUrl && oldPosterUrl && oldPosterUrl !== nextPosterUrl) deleteLocalUploadedImage(oldPosterUrl);
        if (nextBannerUrl && oldBannerUrl && oldBannerUrl !== nextBannerUrl) deleteLocalUploadedImage(oldBannerUrl);

        res.status(200).json({ message: "Cập nhật thông tin Sự kiện thành công", data: updatedEvent });
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Error updating event", error });
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
        const event = await Event.findOne({ _id: event_id, organizer_id }).session(session);

        if (!event) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Sự kiện không tồn tại" });
        }

        if (event.status !== 'published') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Chỉ có thể tạm dừng khi sự kiện đang hiển thị Công khai." });
        }

        const hasPaidOrHoldingOrder = await Order.exists({
            event_id,
            status: { $in: ['pending', 'confirmed'] }
        }).session(session);

        if (hasPaidOrHoldingOrder) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                message: "Không thể hạ trạng thái Sự kiện! Một hoặc nhiều đêm diễn bên trong đã phát sinh đơn giữ chỗ hoặc giao dịch vé."
            });
        }

        event.status = 'draft';
        await event.save({ session });

        const publishedShows = await Show.find({ event_id, status: 'published' }).select('_id').session(session);
        if (publishedShows.length > 0) {
            const showIds = publishedShows.map(s => s._id);
            await Show.updateMany({ _id: { $in: showIds } }, { status: 'draft' }, { session });
            const pipeline = redisClient.multi();
            for (const showId of showIds) {
                const zones = await Zone.find({ show_id: showId }).select('_id').session(session);
                zones.forEach(zone => {
                    const summaryKey = `event:${event_id}:show:${showId}:zone:${zone._id}:summary`;
                    pipeline.del(summaryKey);
                });
                pipeline.del(`show:${showId}:ticket_types`);
                pipeline.del(`show:${showId}:seats_static_layout`);
                pipeline.del(`show:${showId}:seat_status`);
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
            sort: { created_at: -1 },
            select: '_id name description genre poster_url banner_url start_date end_date status created_at',
            lean: true,
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
    const sort = ((req.query.sort as string) || 'newest').trim();
    const limit = parseInt(req.query.limit as string) || 20;
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const now = new Date();

    const findQuery: any = { status: 'published' };

    if (keyword && keyword.trim() !== '' && keyword !== 'undefined' && keyword !== 'null') {
      const cleanKeyword = keyword.trim();
      findQuery.$or = [
        { name: { $regex: cleanKeyword, $options: 'i' } },
        { description: { $regex: cleanKeyword, $options: 'i' } },
        { artists: { $regex: cleanKeyword, $options: 'i' } },
      ];
    }

    if (genre && genre.trim() !== '' && genre !== 'undefined' && genre !== 'all') {
      findQuery.genre = genre.trim();
    }

    let venueIds: any[] | null = null;
    if (city && city.trim() !== '' && city !== 'undefined' && city !== 'all') {
      const matchingVenues = await Venue.find({ city: { $regex: '^' + city.trim() + '$', $options: 'i' } }).select('_id').lean();
      venueIds = matchingVenues.map((v: any) => v._id);
      if (venueIds.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
    }

    const activeShowFilter: any = {
      status: 'published',
      end_time: { $gte: now },
    };
    if (venueIds) activeShowFilter.venue_id = { $in: venueIds };

    const activeShows = await Show.find(activeShowFilter)
      .select('event_id venue_id start_time end_time sale_start sale_end status')
      .populate({ path: 'venue_id', select: 'name city' })
      .sort({ start_time: 1 })
      .lean();

    const activeEventIds = Array.from(new Set(activeShows.map((show: any) => String(show.event_id || show.event)).filter(Boolean)));
    if (activeEventIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    if (findQuery._id && findQuery._id.$in) {
      const existingIds = new Set((findQuery._id.$in as any[]).map((id: any) => String(id)));
      findQuery._id = { $in: activeEventIds.filter((id) => existingIds.has(String(id))) };
    } else {
      findQuery._id = { $in: activeEventIds };
    }

    const sortOption: any = sort === 'upcoming' ? { start_date: 1 } : { created_at: -1 };
    const events = await Event.find(findQuery)
      .select('_id name description genre artists poster_url banner_url start_date end_date created_at status')
      .sort(sortOption)
      .limit(safeLimit * 3)
      .lean();

    const showByEventId = new Map<string, any>();
    for (const show of activeShows) {
      const key = String((show as any).event_id || (show as any).event);
      if (!showByEventId.has(key)) showByEventId.set(key, show);
    }

    const getBookingLabel = (show: any) => {
      const availability = computeShowAvailability(show, now);
      if (availability.time_state === 'ongoing') return 'Đang diễn ra';
      if (availability.time_state === 'past') return 'Đã kết thúc';
      if (availability.is_bookable) return 'Đang mở bán vé';
      if (availability.sale_state === 'coming_soon') return 'Sắp mở bán';
      if (availability.sale_state === 'closed') return 'Đã đóng bán';
      return 'Chưa mở bán';
    };

    const formattedEvents = events
      .map((event: any) => {
        const matchShow = showByEventId.get(String(event._id));
        if (!matchShow) return null;
        const venueInfo = matchShow?.venue_id as any;
        return {
          _id: event._id,
          name: event.name,
          description: event.description,
          genre: event.genre,
          artists: event.artists,
          poster_url: toSafeListImage(event.poster_url),
          banner_url: toSafeListImage(event.banner_url),
          start_date: event.start_date,
          end_date: event.end_date,
          next_show_start_time: matchShow.start_time,
          next_show_end_time: matchShow.end_time,
          booking_label: getBookingLabel(matchShow),
          venue_info: venueInfo ? { name: venueInfo.name, city: venueInfo.city } : null,
        };
      })
      .filter(Boolean) as any[];

    if (sort === 'upcoming') {
      formattedEvents.sort((a, b) => new Date(a.next_show_start_time || a.start_date).getTime() - new Date(b.next_show_start_time || b.start_date).getTime());
    }

    return res.status(200).json({ success: true, data: formattedEvents.slice(0, safeLimit) });
  } catch (error) {
    console.error('[Search Events Backend Error]', error);
    return res.status(500).json({ message: 'Lỗi hệ thống khi truy vấn tìm kiếm sự kiện.' });
  }
};
