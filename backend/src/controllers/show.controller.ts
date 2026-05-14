import Show from '../models/show.model';
import Event from '../models/event.model';
import Zone from '../models/zone.model';
import Seat from '../models/seat.model';
import { warmUpSeatmapCache } from '../services/seatmapService';
import * as cheerio from 'cheerio';
import { Request, Response } from 'express';
import redisClient from '../utils/redisClient';
import { calculateValidQuantities } from '../utils/validQuantities';


export const createShow = async (req: Request, res: Response) => {
    try {
        const event_id = req.params.event_id as string;
        const organizer_id = req.user!.id;

        const {
            name, description, start_time, end_time, venue_id,
            sale_start, sale_end, stadium_map_svg
        } = req.body;

        console.log(`User ${organizer_id} đang tạo show cho event ${event_id}: ${name}`);

        // 1. Validate Input cơ bản
        if (!event_id || !name || !start_time || !end_time || !venue_id || !organizer_id || !sale_start || !sale_end) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Xử lý tier_pricing an toàn
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

        // 2. Validate Quyền tạo Show
        const event = await Event.findOne({ _id: event_id, organizer_id: organizer_id });
        if (!event) {
            return res.status(403).json({ message: "Bạn không có quyền tạo show cho sự kiện này" });
        }
        const mapAssets: any[] = [];
        if (stadium_map_svg) {
            const $ = cheerio.load(stadium_map_svg, { xmlMode: true });

            // Tìm tất cả các thẻ (g hoặc path) có id bắt đầu bằng "asset_"
            $('[id^="asset_"]').each((_, element) => {
                const assetId = $(element).attr('id')!;

                // Nếu bản thân nó là thẻ path thì lấy luôn, nếu là Group (g) thì tìm thẻ path bên trong
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
        // 3. Khởi tạo và Lưu Show (để lấy show_id)
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

        let createdZones: any[] = [];
        let totalSeatsGenerated = 0;


        // Chuẩn bị Pipeline Redis cho toàn bộ Show
        const pipeline = redisClient.multi();
        pipeline.set(`event:${event_id}:show:${savedShow.id}:sale_start`, savedShow.sale_start.toISOString());
        pipeline.set(`event:${event_id}:show:${savedShow.id}:sale_end`, savedShow.sale_end.toISOString());

        // 4. BÓC TÁCH SVG "ALL-IN-ONE"
        if (stadium_map_svg) {
            const $ = cheerio.load(stadium_map_svg, { xmlMode: true });
            const zoneDrafts: any[] = []; // Chứa dữ liệu Zone để insert
            const parsedZonesData: {
                rowsMap: Map<string, any[]>;
                tiersData: Record<string, { count: number }>
            }[] = [];

            // Tìm tất cả các Group (Hoặc Frame) đại diện cho Zone
            $('g[id^="zone_"]').each((_, zoneGroup) => {
                const svgId = $(zoneGroup).attr('id')!;
                const formattedName = svgId.replace('zone_', '').replace(/_/g, ' ');

                // A. Lấy khung Zone (ưu tiên tìm path id="zone_area", nếu không có thì lấy path đầu tiên)
                let pathElement = $(zoneGroup).find('[id^="zone_area"]').first();
                if (pathElement.length === 0) pathElement = $(zoneGroup).find('path').first();
                const pathData = pathElement.attr('d') || "";

                // B. Chuẩn bị logic bóc tách Ghế cho Zone này
                const rowsMap = new Map<string, any[]>();
                const tiersData: Record<string, { count: number }> = {};

                // Tìm các Tier bên TRONG Zone này
                $(zoneGroup).find('g[id^="Type-"]').each((_, typeGroup) => {
                    const typeName = $(typeGroup).attr('id')!.replace('Type-', '').toUpperCase();
                    if (!tiersData[typeName]) tiersData[typeName] = { count: 0 };

                    // Tìm các Row bên TRONG Tier này
                    $(typeGroup).find('g[id*="row-" i], g[id*="Row-"]').each((_, rowGroup) => {
                        const rowIdAttr = $(rowGroup).attr('id') || '';

                        // 🪄 Regex bóc tách chữ/số đằng sau 'row-', tự động phớt lờ dấu gạch dưới '_'
                        const matchRow = rowIdAttr.match(/row-([a-zA-Z0-9]+)/i);
                        if (!matchRow) return; // Nếu không khớp thì bỏ qua

                        // Đưa tên hàng về viết hoa cho chuẩn (VD: 'a' -> 'A')
                        const rowName = matchRow[1].toUpperCase();

                        if (!rowsMap.has(rowName)) rowsMap.set(rowName, []);

                        // TÌM SEAT BÊN TRONG ROW
                        $(rowGroup).find('g[id*="seat-" i], g[id*="Seat-"]').each((_, seatGroup: any) => {
                            const seatIdAttr = $(seatGroup).attr('id') || '';

                            // 🪄 Regex bóc tách số ghế đằng sau 'seat-', tự động loại bỏ hậu tố '_1', '_2'
                            const matchSeat = seatIdAttr.match(/seat-([a-zA-Z0-9]+)/i);
                            if (!matchSeat) return;

                            // 1. LẤY SỐ GHẾ TỪ THẺ <g> ĐÃ ĐƯỢC LÀM SẠCH
                            const seatIdStr = matchSeat[1];
                            const seatNumber = parseInt(seatIdStr, 10);
                            // 2. LẤY TỌA ĐỘ TỪ THẺ <circle> NẰM BÊN TRONG THẺ <g>
                            const circle = $(seatGroup).find('circle').first();

                            // Kiểm tra an toàn: Nếu là số hợp lệ VÀ bên trong có hình tròn
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

                // C. Lưu dữ liệu thô vào mảng tạm
                zoneDrafts.push({
                    event_id: event_id,
                    show_id: savedShow._id,
                    name: formattedName,
                    overall_map_svg_id: svgId,
                    path_data: pathData,
                    capacity: 0, // Sẽ cập nhật sau
                    ticket_types: []
                });

                // Lưu lại Map ghế để móc nối với DB Zone ID sau này
                parsedZonesData.push({ rowsMap, tiersData });
            });

            // 5. INSERT ZONES VÀO DB ĐỂ LẤY ZONES_ID
            if (zoneDrafts.length > 0) {
                createdZones = await Zone.insertMany(zoneDrafts);

                const seatsToInsert: any[] = [];

                // 6. MAP GHẾ VỚI ZONE_ID & BUILD CHUỖI REDIS
                // Vì createdZones giữ đúng thứ tự mảng của zoneDrafts nên ta dùng Index để map
                createdZones.forEach((dbZone, index) => {
                    const { rowsMap, tiersData } = parsedZonesData[index];
                    let zoneCapacity = 0;
                    const rowStringsForRedis: Record<string, string> = {};

                    // Duyệt từng hàng để xây chuỗi Redis và tạo object Seat
                    for (const [rowName, circles] of rowsMap.entries()) {
                        circles.sort((a, b) => a.seat_number_val - b.seat_number_val);
                        const maxSeatNumber = circles[circles.length - 1]?.seat_number_val || 0;
                        const redisRowArray = Array(maxSeatNumber).fill('X');

                        circles.forEach((circle) => {
                            const colIndex = circle.seat_number_val;
                            redisRowArray[colIndex - 1] = 'O';

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
                                status: 'available'
                            });
                            zoneCapacity++;
                        });

                        rowStringsForRedis[rowName] = redisRowArray.join('');
                    }

                    // Cập nhật lại capacity cho DB Zone
                    dbZone.capacity = zoneCapacity;

                    // Chuẩn bị Pipeline Redis cho riêng Zone này
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
                        if (data.count > 0) { // Chỉ đưa lên Redis nếu tier có ghế
                            pipeline.hSet(summaryKey, `tier:${tierName}:count`, String(data.count));
                            const price = tier_pricing[tierName] ?? 0;
                            pipeline.hSet(summaryKey, `tier:${tierName}:price`, String(price));
                        }
                    }
                });

                // 7. INSERT SEATS & LƯU LẠI CAPACITY CỦA ZONES
                if (seatsToInsert.length > 0) {
                    await Seat.insertMany(seatsToInsert);
                    totalSeatsGenerated = seatsToInsert.length;

                    // Lưu lại thay đổi capacity của từng Zone
                    await Promise.all(createdZones.map(z => z.save()));
                    const staticLayoutCacheKey = `show:${savedShow._id}:seats_static_layout`;
                    pipeline.set(staticLayoutCacheKey, JSON.stringify(seatsToInsert), {
                        EX: 86400 // Cache sống trong 24 giờ (hoặc bạn có thể bỏ EX đi nếu muốn nó sống vĩnh viễn đến khi show kết thúc)
                    });
                }
            }
        }

        // 8. THỰC THI PIPELINE REDIS (Một lần gọi duy nhất cho hàng trăm keys)
        await pipeline.exec();

        res.status(201).json({
            message: "Tạo Show, quét sơ đồ và khởi tạo Seatmap thành công!",
            show: savedShow,
            auto_generated_zones: createdZones,
            total_seats_generated: totalSeatsGenerated
        });

    } catch (error) {
        console.error("Lỗi khi tạo show toàn diện:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi khởi tạo Show", error });
    }
};

export const getShowsByEvent = async (req: Request, res: Response) => {
    try {
        const { event_id, page } = req.params;
        const { start_date, end_date } = req.body;
        const event = await Event.findById(event_id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        const now = new Date();
        let filter = {};

        if (start_date && end_date) {
            filter = { ...filter, start_date: { $gte: new Date(start_date as string) }, end_date: { $lte: new Date(end_date as string) } };
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
        const organizer_id = req.user!.id; // Lấy ID của Organizer từ token

        // Dùng req.query thay vì req.body/req.params cho các bộ lọc của phương thức GET
        const { page, start_date, end_date } = req.query;

        // 1. Kiểm tra quyền sở hữu (BẢO MẬT CỐT LÕI)
        // Đảm bảo Event này là của chính ông Organizer này tạo ra
        const event = await Event.findOne({ _id: event_id, organizer_id: organizer_id });
        if (!event) {
            return res.status(403).json({ message: "Sự kiện không tồn tại hoặc bạn không có quyền truy cập!" });
        }

        // 2. Xây dựng bộ lọc (Không chặn show quá khứ như Public API)
        let filter: any = { event_id: event_id };

        // Lưu ý: Tên trường trong DB của bạn thường là start_time/end_time chứ không phải start_date
        if (start_date && end_date) {
            filter.start_time = {
                $gte: new Date(start_date as string),
                $lte: new Date(end_date as string)
            };
        }

        const options = {
            page: parseInt(page as string) || 1,
            limit: 10,
            sort: { start_time: -1 } // Organizer thường thích xem Show mới nhất lên đầu (-1)
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

        // 1. Query Show, Populate dữ liệu và Loại bỏ rác
        const show = await Show.findById(show_id)
            .populate('event_id', 'name poster') // Lấy thêm tên Event để Frontend hiển thị header
            .populate('venue_id', 'name address') // Lấy thêm tên Venue
            .select('-stadium_map_svg') // BÍ QUYẾT TỐI ƯU: Không trả về file SVG gốc
            .lean();

        if (!show) {
            return res.status(404).json({ message: "Show not found" });
        }

        // 2. Lấy luôn mảng Zones (Khung khán đài) để Frontend vẽ Layer 1
        const zones = await Zone.find({ show_id })
            .select('name path_data overall_map_svg_id capacity') // Chỉ lấy tọa độ path
            .lean();

        // 3. Trả về một cục Data hoàn chỉnh cho React Konva khởi tạo
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

        // 1. Tìm Show
        const show = await Show.findById(show_id);
        if (!show) return res.status(404).json({ message: "Show không tồn tại" });

        // 2. Validate: Chống Publish 2 lần
        if (show.status === 'published') {
            return res.status(400).json({ message: "Show này đã được publish rồi!" });
        }

        const seatCount = await Seat.countDocuments({ show_id });
        if (seatCount === 0) {
            return res.status(400).json({
                message: "Không thể Publish! Vui lòng generate ghế cho các Zone trước."
            });
        }

        // 4. Cập nhật trạng thái trong Database
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