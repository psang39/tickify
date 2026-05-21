import Show from '../models/show.model';
import Event from '../models/event.model';
import Zone from '../models/zone.model';
import Seat from '../models/seat.model';
import TicketType from '../models/ticket-type.model';
import { warmUpSeatmapCache } from '../services/seatmapService';
import * as cheerio from 'cheerio';
import { Request, Response } from 'express';
import redisClient from '../utils/redisClient';
import { calculateValidQuantities } from '../utils/validQuantities';
import mongoose from 'mongoose';
export const createShow = async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const event_id = req.params.event_id as string;
        const organizer_id = req.user!.id;
        const {
            name, description, start_time, end_time, venue_id,
            sale_start, sale_end, stadium_map_svg, ticket_types
        } = req.body;
        console.log(`User ${organizer_id} đang tạo show cho event ${event_id}: ${name}`);
        if (!event_id || !name || !start_time || !end_time || !venue_id || !organizer_id || !sale_start || !sale_end) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        let tier_pricing: Record<string, number> = {};
        if (req.body.tier_pricing) {
            try {
                tier_pricing = typeof req.body.tier_pricing === 'string'
                    ? JSON.parse(req.body.tier_pricing)
                    : req.body.tier_pricing;
            } catch (e) {
                return res.status(400).json({ message: "tier_pricing phải là JSON hợp lệ" });
            }
        }
        const event = await Event.findOne({ _id: event_id, organizer_id: organizer_id });
        if (!event) {
            return res.status(403).json({ message: "Bạn không có quyền tạo show cho sự kiện này" });
        }
        const mapAssets: any[] = [];
        if (stadium_map_svg) {
            const $ = cheerio.load(stadium_map_svg, { xmlMode: true });
            $('[id^="asset_"]').each((_, element) => {
                const assetId = $(element).attr('id')!;
                let pathElement = $(element).is('path') ? $(element) : $(element).find('path').first();
                const pathData = pathElement.attr('d') || "";
                if (pathData) {
                    mapAssets.push({
                        asset_id: assetId,
                        path_data: pathData
                    });
                }
            });
        }
        const newShow = new Show({
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
            map_assets: mapAssets
        });
        const savedShow = await newShow.save();
        const createdTicketTypes = [] as any[];
        if (ticket_types && ticket_types.length > 0) {
            for (const ttData of ticket_types) {
                const ticketType = new TicketType({
                    ...ttData,
                    event_id: event_id,
                    show_id: savedShow._id,
                });
                await ticketType.save({ session });
                createdTicketTypes.push(ticketType);
            }
        }
        const ticketTypesCache = createdTicketTypes.map(tt => ({
            id: tt._id,
            name: tt.name,
            price: tt.price,

        }));


        await redisClient.set(`show:${savedShow._id}:ticket_types`, JSON.stringify(ticketTypesCache));
        const tierToTicketTypeIdMap: Record<string, any> = {};
        createdTicketTypes.forEach(tt => {
            tierToTicketTypeIdMap[tt.target_tier.toUpperCase()] = tt._id;
        });
        let createdZones: any[] = [];
        let totalSeatsGenerated = 0;
        const pipeline = redisClient.multi();
        pipeline.set(`event:${event_id}:show:${savedShow._id}:sale_start`, savedShow.sale_start.toISOString());
        pipeline.set(`event:${event_id}:show:${savedShow._id}:sale_end`, savedShow.sale_end.toISOString());
        if (stadium_map_svg) {
            const $ = cheerio.load(stadium_map_svg, { xmlMode: true });
            const zoneDrafts: any[] = [];
            const parsedZonesData: {
                rowsMap: Map<string, any[]>;
                tiersData: Record<string, { count: number }>
            }[] = [];
            $('g[id^="zone_"]').each((_, zoneGroup) => {
                const svgId = $(zoneGroup).attr('id')!;
                const formattedName = svgId.replace('zone_', '').replace(/_/g, ' ');
                let pathElement = $(zoneGroup).find('[id^="zone_area"]').first();
                if (pathElement.length === 0) pathElement = $(zoneGroup).find('path').first();
                const pathData = pathElement.attr('d') || "";
                const rowsMap = new Map<string, any[]>();
                const tiersData: Record<string, { count: number }> = {};
                $(zoneGroup).find('g[id^="Type-"]').each((_, typeGroup) => {
                    const typeId = $(typeGroup).attr('id') || '';
                    const typeName = typeId.replace(/^Type-/, '').split(/[-_]/)[0].toUpperCase();

                    if (!tiersData[typeName]) tiersData[typeName] = { count: 0 };
                    $(typeGroup).find('g[id*="row-" i], g[id*="Row-"]').each((_, rowGroup) => {
                        const rowIdAttr = $(rowGroup).attr('id') || '';
                        const matchRow = rowIdAttr.match(/row-([a-zA-Z0-9]+)/i);
                        if (!matchRow) return;
                        const rowName = matchRow[1].toUpperCase();
                        if (!rowsMap.has(rowName)) rowsMap.set(rowName, []);
                        $(rowGroup).find('g[id*="seat-" i], g[id*="Seat-"]').each((_, seatGroup: any) => {
                            const seatIdAttr = $(seatGroup).attr('id') || '';
                            const matchSeat = seatIdAttr.match(/seat-([a-zA-Z0-9]+)/i);
                            if (!matchSeat) return;
                            const seatIdStr = matchSeat[1];
                            const seatNumber = parseInt(seatIdStr, 10);
                            const circle = $(seatGroup).find('circle').first();
                            if (!isNaN(seatNumber) && circle.length > 0) {
                                rowsMap.get(rowName)!.push({
                                    seat_number_val: seatNumber,
                                    x: parseFloat(circle.attr('cx') || '0'),
                                    y: parseFloat(circle.attr('cy') || '0'),
                                    tier: typeName
                                });
                                tiersData[typeName].count++;
                            }
                        });
                    });
                });
                zoneDrafts.push({
                    event_id: event_id,
                    show_id: savedShow._id,
                    name: formattedName,
                    overall_map_svg_id: svgId,
                    path_data: pathData,
                    capacity: 0,
                });
                parsedZonesData.push({ rowsMap, tiersData });
            });
            if (zoneDrafts.length > 0) {
                createdZones = await Zone.insertMany(zoneDrafts, { session });
                const seatsToInsert: any[] = [];
                createdZones.forEach((dbZone, index) => {
                    const { rowsMap, tiersData } = parsedZonesData[index];
                    let zoneCapacity = 0;
                    const rowStringsForRedis: Record<string, string> = {};
                    for (const [rowName, circles] of rowsMap.entries()) {
                        circles.sort((a, b) => a.seat_number_val - b.seat_number_val);
                        const maxSeatNumber = circles[circles.length - 1]?.seat_number_val || 0;
                        const redisRowArray = Array(maxSeatNumber).fill('X');
                        circles.forEach((circle) => {
                            const colIndex = circle.seat_number_val;
                            redisRowArray[colIndex - 1] = 'O';
                            const matchTicketTypeId = tierToTicketTypeIdMap[circle.tier.toUpperCase()];
                            seatsToInsert.push({
                                zone_id: dbZone._id,
                                event_id: event_id,
                                show_id: savedShow._id,
                                tier: circle.tier,
                                row: rowName,
                                col_index: colIndex,
                                seat_number: `${rowName}-${colIndex}`,
                                x: circle.x,
                                y: circle.y,
                                status: 'available',
                                ticket_type_id: matchTicketTypeId ? matchTicketTypeId : null
                            });
                            zoneCapacity++;
                        });
                        rowStringsForRedis[rowName] = redisRowArray.join('');
                    }
                    dbZone.capacity = zoneCapacity;
                    const summaryKey = `event:${event_id}:show:${savedShow._id}:zone:${dbZone._id}:summary`;
                    for (const [rowLabel, rowStr] of Object.entries(rowStringsForRedis)) {
                        const rowKey = `event:${event_id}:show:${savedShow._id}:zone:${dbZone._id}:row:${rowLabel}`;
                        pipeline.set(rowKey, rowStr);
                    }
                    const allRowStrings = Object.values(rowStringsForRedis);
                    if (allRowStrings.length > 0) {
                        const validQuantities = calculateValidQuantities(allRowStrings);
                        pipeline.hSet(summaryKey, 'valid_quantities', JSON.stringify(validQuantities));
                    }
                    for (const [tierName, data] of Object.entries(tiersData)) {
                        if (data.count > 0) {
                            pipeline.hSet(summaryKey, `tier:${tierName}:count`, String(data.count));
                            const price = tier_pricing[tierName] ?? 0;
                            pipeline.hSet(summaryKey, `tier:${tierName}:price`, String(price));
                        }
                    }
                });
                if (seatsToInsert.length > 0) {
                    const insertedSeats = await Seat.insertMany(seatsToInsert, { session });
                    totalSeatsGenerated = seatsToInsert.length;
                    await Promise.all(createdZones.map(z => z.save()));
                    const staticLayoutCacheKey = `show:${savedShow._id}:seats_static_layout`;
                    pipeline.set(staticLayoutCacheKey, JSON.stringify(insertedSeats), {
                        EX: 86400
                    });
                }
            }
        }
        await pipeline.exec();
        res.status(201).json({
            message: "Tạo Show, quét sơ đồ và khởi tạo Seatmap thành công!",
            show: savedShow,
            auto_generated_zones: createdZones,
            total_seats_generated: totalSeatsGenerated
        });
        await session.commitTransaction();
        session.endSession();
    } catch (error) {
        console.error("Lỗi khi tạo show toàn diện:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi khởi tạo Show", error });
    }
};
export const getShowsByEvent = async (req: Request, res: Response) => {
    try {
        const { event_id, page } = req.params;
        const { start_time, end_time } = req.body;
        const event = await Event.findById(event_id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        const now = new Date();
        let filter = {};
        if (start_time && end_time) {
            filter = { ...filter, start_time: { $gte: new Date(start_time as string) }, end_time: { $lte: new Date(end_time as string) } };
        }
        else {
            filter = { ...filter, start_date: { $gte: now } };
        }
        filter = { ...filter, event_id: event_id };
        const options = {
            page: parseInt(page as string) || 1,
            limit: 10,
            sort: { date: 1 }
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
            .select('-stadium_map_svg')
            .lean();
        if (!show) {
            return res.status(404).json({ message: "Show not found" });
        }
        const zones = await Zone.find({ show_id })
            .select('name path_data overall_map_svg_id capacity')
            .lean();
        res.status(200).json({
            show_info: show,
            zones: zones
        });
    } catch (error) {
        console.error("Lỗi khi fetch Show:", error);
        res.status(500).json({ message: "Error fetching show", error });
    }
};
export const updateShow = async (req: Request, res: Response) => {
    try {
        const { show_id } = req.params;
        const updateData = req.body;
        const updatedShow = await Show.findByIdAndUpdate(show_id, updateData, { new: true });
        if (!updatedShow) {
            return res.status(404).json({ message: "Show not found" });
        }
        res.status(200).json(updatedShow);
    } catch (error) {
        res.status(500).json({ message: "Error updating show", error });
    }
};
export const deleteShow = async (req: Request, res: Response) => {
    try {
        const { show_id } = req.params;
        const deletedShow = await Show.findByIdAndDelete(show_id);
        if (!deletedShow) {
            return res.status(404).json({ message: "Show not found" });
        }
        res.status(200).json({ message: "Show deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting show", error });
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
        show.status = 'published';
        await show.save();
        try {
            await warmUpSeatmapCache(show_id);
        } catch (cacheError) {
            show.status = 'draft';
            await show.save();
            throw new Error("Lỗi nạp Cache Redis, đã hạ Show về lại bản Draft.");
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