import Show from '../models/show.model';
import Event from '../models/event.model';
import Zone from '../models/zone.model';
import Seat from '../models/seat.model';
import TicketType from '../models/ticket-type.model';
import Order from '../models/order.model';
import Venue from '../models/venue.model';
import { rebuildShowRedisCache, purgeShowRedisCache, hasBlockingOrdersForShow, regenerateSeatmapWithTransaction, regenerateSeatmapFromSvg, parseMapAssetsFromSvg } from '../services/seatmap-cache.service';
import * as cheerio from 'cheerio';
import { Request, Response } from 'express';
import redisClient from '../utils/redisClient';
import { calculateValidQuantities } from '../utils/validQuantities';
import mongoose from 'mongoose';
import { formatHashToJSON } from '../utils/hashToJson';
import { generateRSAKeyPair, encryptPrivateKey } from '../utils/cryptoUtils';

export const createShow = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const event_id = req.params.event_id as string;
        const organizer_id = req.user!.id;
        const {
            name,
            description,
            start_time,
            end_time,
            venue_id,
            sale_start,
            sale_end,
            stadium_map_svg,
            ticket_types
        } = req.body;

        if (!event_id || !name || !start_time || !end_time || !venue_id || !organizer_id || !sale_start || !sale_end) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Missing required fields" });
        }

        if (new Date(start_time) > new Date(end_time)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "End time must be later than start time" });
        }

        if (new Date(sale_start) > new Date(sale_end)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Sale end time must be later than sale start time" });
        }

        const event = await Event.findOne({ _id: event_id, organizer_id }).session(session);
        if (!event) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: "Bạn không có quyền tạo show cho sự kiện này" });
        }

        if (new Date(start_time) < new Date(event.start_date)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Show start time must be within event duration" });
        }

        if (new Date(end_time) > new Date(event.end_date)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Show end time must be within event duration" });
        }

        const { publicKey, privateKey } = generateRSAKeyPair();
        const encryptedPrivateKey = encryptPrivateKey(privateKey);

        const [savedShow] = await Show.create([{
            event_id,
            name,
            description,
            sale_start: new Date(sale_start),
            sale_end: new Date(sale_end),
            start_time: new Date(start_time),
            end_time: new Date(end_time),
            venue_id,
            organizer_id,
            stadium_map_svg,
            map_assets: parseMapAssetsFromSvg(stadium_map_svg),
            public_key: publicKey,
            encrypted_private_key: encryptedPrivateKey
        }], { session });

        let parsedTicketTypes = ticket_types || [];
        if (typeof parsedTicketTypes === 'string') {
            try {
                parsedTicketTypes = JSON.parse(parsedTicketTypes);
            } catch {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: "ticket_types phải là JSON hợp lệ" });
            }
        }

        if (Array.isArray(parsedTicketTypes) && parsedTicketTypes.length > 0) {
            await TicketType.insertMany(
                parsedTicketTypes.map((ticketType: any) => ({
                    ...ticketType,
                    price: Number(ticketType.price || 0),
                    total_quantity: ticketType.total_quantity === '' || ticketType.total_quantity === undefined
                        ? null
                        : ticketType.total_quantity,
                    event_id,
                    show_id: savedShow._id
                })),
                { session }
            );
        }

        let seatmapResult: any = { zones: [], total_seats_generated: 0 };
        if (stadium_map_svg) {
            seatmapResult = await regenerateSeatmapFromSvg({
                showId: savedShow._id.toString(),
                stadiumMapSvg: stadium_map_svg,
                session
            });
        }

        await session.commitTransaction();
        session.endSession();

        await rebuildShowRedisCache(savedShow._id.toString());

        res.status(201).json({
            message: "Tạo Show, quét sơ đồ và khởi tạo Seatmap thành công!",
            show: savedShow,
            auto_generated_zones: seatmapResult.zones,
            total_seats_generated: seatmapResult.total_seats_generated
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Lỗi khi tạo show toàn diện:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi khởi tạo Show", error });
    }
};
export const getShowsByEvent = async (req: Request, res: Response) => {
    try {
        const { event_id } = req.params;
        const { page, limit, start_time, end_time, status } = req.query;
        const event = await Event.findById(event_id).select('status').lean();
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        const filter: any = { event_id };
        if (status) {
            filter.status = status;
        } else if (event.status === 'published') {
            filter.status = 'published';
        }
        if (start_time && end_time) {
            filter.start_time = {
                $gte: new Date(start_time as string),
                $lte: new Date(end_time as string)
            };
        }

        const options = {
            page: parseInt(page as string) || 1,
            limit: Math.min(parseInt(limit as string) || 10, 50),
            sort: { start_time: 1 },
            populate: { path: 'venue_id', select: 'name address city latitude longitude capacity' },
            select: '-stadium_map_svg -encrypted_private_key',
            lean: true
        };
        const shows = await Show.paginate(filter, options);
        res.status(200).json(shows);
    } catch (error) {
        res.status(500).json({ message: "Error fetching shows", error });
    }
};
export const getOrganizerShowsByEvent = async (req: Request, res: Response) => {
    try {
        const { event_id } = req.params;
        const organizer_id = req.user!.id;
        const { page, start_time, end_time } = req.query;
        const event = await Event.findOne({ _id: event_id, organizer_id: organizer_id });
        if (!event) {
            return res.status(403).json({ message: "Sự kiện không tồn tại hoặc bạn không có quyền truy cập!" });
        }
        let filter: any = { event_id: event_id };
        if (start_time && end_time) {
            filter.start_time = {
                $gte: new Date(start_time as string),
                $lte: new Date(end_time as string)
            };
        }
        const options = {
            page: parseInt(page as string) || 1,
            limit: 10,
            sort: { start_time: -1 }
        };
        const shows = await Show.paginate(filter, options);
        res.status(200).json(shows);
    } catch (error) {
        console.error("Lỗi khi fetch shows cho organizer:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi tải danh sách Show", error });
    }
};
export const getShowById = async (req: Request, res: Response) => {
    try {
        const { show_id } = req.params;
        const show = await Show.findById(show_id)
            .populate('event_id', 'name poster')
            .populate('venue_id', 'name address')
            .select('-stadium_map_svg -encrypted_private_key ')
            .lean();
        if (!show) {
            return res.status(404).json({ message: "Show not found" });
        }
        if (show.status !== 'published') {
            return res.status(403).json({ message: "Show is not published" });
        }

        const zones = await Zone.find({ show_id })
            .select('_id name path_data overall_map_svg_id capacity is_standing ticket_type_id')
            .lean();
        const zoneSummariesDict: Record<string, any> = {};
        const ticketTypes = await TicketType.find({ show_id: show_id }).sort({ price: 1, name: 1 }).lean();


        const summaryPromises = zones.map(zone => {
            const summaryKey = `event:${(show.event_id as any)._id}:show:${show._id.toString()}:zone:${zone._id.toString()}:summary`;
            return redisClient.hGetAll(summaryKey);
        });

        const rawSummaries = await Promise.all(summaryPromises);

        zones.forEach((zone, index) => {
            const rawHash = rawSummaries[index];
            if (rawHash && Object.keys(rawHash).length > 0) {
                zoneSummariesDict[zone._id.toString()] = formatHashToJSON(rawHash);
            } else {
                zoneSummariesDict[zone._id.toString()] = {
                    min_price: 0,
                    valid_quantities: {},
                    tiers: {}
                };
            }
        });
        res.status(200).json({
            show_info: show,
            zones: zones,
            ticket_types: ticketTypes,
            zone_summaries: zoneSummariesDict
        });



    } catch (error) {
        console.error("Lỗi khi fetch Show:", error);
        res.status(500).json({ message: "Error fetching show", error });
    }
};
export const getOrganizerShowById = async (req: Request, res: Response) => {
    try {
        const { show_id } = req.params;
        const show = await Show.findById(show_id)
            .populate('event_id', 'name poster')
            .populate('venue_id', 'name address')
            .select('-stadium_map_svg -encrypted_private_key ')
            .lean();
        if (!show) {
            return res.status(404).json({ message: "Show not found" });
        }
        if (show.organizer_id.toString() !== req.user!.id) {
            return res.status(403).json({ message: "Bạn không có quyền truy cập thông tin show này" });
        }


        const zones = await Zone.find({ show_id })
            .select('_id name path_data overall_map_svg_id capacity is_standing ticket_type_id')
            .lean();

        const ticketTypes = await TicketType.find({ show_id })
            .sort({ price: 1, name: 1 })
            .lean();

        const zoneSummariesDict: Record<string, any> = {};


        res.status(200).json({
            show_info: show,
            zones: zones,
            ticket_types: ticketTypes,
            zone_summaries: zoneSummariesDict
        });



    } catch (error) {
        console.error("Lỗi khi fetch Show:", error);
        res.status(500).json({ message: "Error fetching show", error });
    }
};
export const updateShow = async (req: Request, res: Response) => {
    try {
        const show_id = req.params.show_id as string;
        const {
            name, description, start_time, end_time, sale_start, sale_end,
            venue_id, stadium_map_svg, ticket_types
        } = req.body;

        const show = await Show.findById(show_id);
        if (!show) return res.status(404).json({ message: "Show không tồn tại" });

        if (show.status === 'published') {
            return res.status(400).json({
                message: "Show đang mở bán công khai. Vui lòng 'Tạm dừng bán' trước khi điều chỉnh thông tin cấu hình."
            });
        }

        // ticket_types ở đây chỉ dùng cho flow upload/generate seatmap.
        // Chỉnh giá/tên/thông tin bán vé của ticket-type đã sinh nên đi qua ticket-type.controller.updateTicketType,
        // để không regenerate toàn bộ seatmap một cách không cần thiết.
        const isSeatmapUpdate = Boolean(stadium_map_svg || ticket_types);
        if (isSeatmapUpdate) {
            const hasBlockingOrders = await hasBlockingOrdersForShow(show_id);
            if (hasBlockingOrders) {
                return res.status(400).json({
                    message: "Show đã có đơn pending/confirmed nên không thể upload lại SVG hoặc tạo lại seatmap."
                });
            }
        }

        show.name = name ?? show.name;
        show.description = description ?? show.description;
        show.start_time = start_time ? new Date(start_time) : show.start_time;
        show.end_time = end_time ? new Date(end_time) : show.end_time;
        show.sale_start = sale_start ? new Date(sale_start) : show.sale_start;
        show.sale_end = sale_end ? new Date(sale_end) : show.sale_end;
        show.venue_id = venue_id ?? show.venue_id;

        if (stadium_map_svg) {
            show.stadium_map_svg = stadium_map_svg;
            show.map_assets = parseMapAssetsFromSvg(stadium_map_svg);
        }

        const updatedShow = await show.save();

        let seatmapResult = null;
        if (isSeatmapUpdate) {
            seatmapResult = await regenerateSeatmapWithTransaction({
                showId: show_id,
                stadiumMapSvg: stadium_map_svg || updatedShow.stadium_map_svg,
                ticketTypes: ticket_types
            });
        } else {
            await rebuildShowRedisCache(show_id);
        }

        res.status(200).json({
            message: isSeatmapUpdate
                ? "Cập nhật show và tạo lại seatmap thành công"
                : "Cập nhật thông tin form thành công",
            data: updatedShow,
            seatmap: seatmapResult
        });
    } catch (error) {
        console.error("Error updating show:", error);
        res.status(500).json({ message: "Error updating show", error });
    }
};
export const unpublishShow = async (req: Request, res: Response) => {
    try {
        const show_id = req.params.show_id as string;
        const show = await Show.findById(show_id);
        if (!show) return res.status(404).json({ message: "Show không tồn tại" });

        if (show.status !== 'published') {
            return res.status(400).json({ message: "Chỉ có thể tạm dừng khi show đang ở trạng thái Công khai." });
        }

        const hasBlockingOrders = await hasBlockingOrdersForShow(show_id);
        if (hasBlockingOrders) {
            return res.status(400).json({
                message: "Show này đã có đơn pending/confirmed. Không thể unpublish để tránh sai lệch giữ chỗ, đối soát và vé đã bán."
            });
        }

        show.status = 'draft';
        await show.save();
        await purgeShowRedisCache(show_id);

        res.status(200).json({ message: "Đã tạm dừng bán thành công. Show đã quay về dạng bản nháp và Redis cache đã được dọn sạch." });
    } catch (error) {
        console.error("Lỗi khi unpublish show:", error);
        res.status(500).json({ message: "Lỗi Server", error });
    }
};
export const cancelShow = async (req: Request, res: Response) => {
    try {
        const show_id = req.params.show_id as string;
        const show = await Show.findById(show_id);
        if (!show) return res.status(404).json({ message: "Show không tồn tại" });

        if (show.status === 'cancelled') {
            return res.status(400).json({ message: "Show diễn này vốn đã bị hủy trước đó." });
        }
        show.status = 'cancelled';
        await show.save();
        await purgeShowRedisCache(show_id);

        res.status(200).json({
            message: "Hủy show diễn thành công. Sơ đồ bán vé đã đóng, dữ liệu giao dịch cũ được bảo toàn để phục vụ hoàn tiền."
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi hủy show", error });
    }
};
export const publishShow = async (req: Request, res: Response) => {
    try {
        const show_id = req.params.show_id as string;
        const show = await Show.findById(show_id);
        if (!show) return res.status(404).json({ message: "Show không tồn tại" });
        if (show.status === 'published') {
            return res.status(400).json({ message: "Show này đã được publish rồi!" });
        }
        const seatCount = await Seat.countDocuments({ show_id });
        if (seatCount === 0) {
            return res.status(400).json({
                message: "Không thể Publish! Vui lòng generate ghế cho các Zone trước."
            });
        }
        const venue = await Venue.findById(show.venue_id);
        if (!venue || venue.is_verified !== true) {
            return res.status(400).json({
                success: false,
                message: `Không thể mở bán! Địa điểm "${venue?.name || 'Chưa xác định'}" đang trong trạng thái chờ Admin xét duyệt hạ tầng sơ đồ ghế.`
            });
        }
        show.status = 'published';
        await show.save();
        try {
            await rebuildShowRedisCache(show_id);
        } catch (cacheError) {
            show.status = 'draft';
            await show.save();
            throw new Error("Lỗi rebuild Redis cache, đã hạ Show về lại bản Draft.");
        }
        res.status(200).json({
            message: "Publish Show thành công! Hệ thống đã sẵn sàng đón tải.",
            seat_cached: seatCount
        });
    } catch (error) {
        console.error("Lỗi khi publish show:", error);
        res.status(500).json({ message: "Lỗi Server", error });
    }
};