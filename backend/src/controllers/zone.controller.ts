import Zone from "../models/zone.model";
import Seat from "../models/seat.model";
import Event from "../models/event.model";
import Show from "../models/show.model";
import { Request, Response } from "express";
import redisClient from "../utils/redisClient";
import { calculateValidQuantities } from "../utils/validQuantities";
import cheerio from "cheerio";
import 'multer';
import { validateOrphanSeats } from "../utils/seatValidation";

export const createZone = async (req: Request, res: Response) => {
    try {
        const event_id = req.params.event_id as string;
        const show_id = req.params.show_id as string;
        const { name, capacity, layout_map, is_standing } = req.body;
        if (!name || !event_id || !capacity) {
            return res.status(400).json({ message: "Name, event ID, and capacity are required" });
        }
        const existingEvent = await Event.findById(event_id);
        if (!existingEvent) {
            return res.status(404).json({ message: "Event not found" });
        }
        const existingShow = await Show.findById(show_id);
        if (!existingShow) {
            return res.status(404).json({ message: "Show not found" });
        }
        const zone = new Zone({ name, event_id, show_id, capacity, layout_map, is_standing });
        await zone.save();
        await redisClient.set(`show:${show_id}:zone:${zone._id}:available`, capacity.toString());
        res.status(201).json(zone);
    } catch (error) {
        console.error("Error creating zone:", error);
        res.status(500).json({ message: "Error creating zone", error });
    }
};

// Nhớ import các model Zone, Seat, Show, Event và redisClient, calculateValidQuantities của bạn vào đây

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
            stadium_map_svg
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
                    $(typeGroup).find('g[id^="Row-"]').each((_, rowGroup) => {
                        const rowName = $(rowGroup).attr('id')!.replace('Row-', '');
                        if (!rowsMap.has(rowName)) rowsMap.set(rowName, []);

                        // Tìm các Seat bên TRONG Row này
                        $(rowGroup).find('circle[id^="Seat-"]').each((_, circle: any) => {
                            const seatIdStr = $(circle).attr('id')!.replace('Seat-', '');
                            const seatNumber = parseInt(seatIdStr, 10);

                            if (!isNaN(seatNumber)) {
                                rowsMap.get(rowName)!.push({
                                    seat_number_val: seatNumber,
                                    x: parseFloat($(circle).attr('cx') || '0'),
                                    y: parseFloat($(circle).attr('cy') || '0'),
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

export const getZonesByEvent = async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const zones = await Zone.find({ event_id: eventId });
        res.status(200).json(zones);
    } catch (error) {
        res.status(500).json({ message: "Error fetching zones", error });
    }
};

export const getZoneById = async (req: Request, res: Response) => {
    try {
        const { zoneId } = req.params;
        const zone = await Zone.findById(zoneId);
        if (!zone) {
            return res.status(404).json({ message: "Zone not found" });
        } res.status(200).json(zone);
    } catch (error) {
        res.status(500).json({ message: "Error fetching zone", error });
    }
};

export const updateZone = async (req: Request, res: Response) => {
    try {
        const event_id = req.params.event_id as string;
        const show_id = req.params.show_id as string;
        const zone_id = req.params.zoneId as string;
        const existingEvent = await Event.findById(event_id);
        if (!existingEvent) {
            return res.status(404).json({ message: "Event not found" });
        }
        const { name, capacity, layout_map, is_standing } = req.body;
        const zone = await Zone.findByIdAndUpdate(
            req.params.zoneId,
            { name, capacity, layout_map, is_standing },
            { new: true }
        );
        if (!zone) {
            return res.status(404).json({ message: "Zone not found" });
        }
        res.status(200).json(zone);
    } catch (error) {
        res.status(500).json({ message: "Error updating zone", error });
    }
};

export const checkZoneAvailability = async (req: Request, res: Response) => {
    try {
        const { event_id, show_id, zone_id } = req.params;
        const { showId } = req.query;
        const requestedQty = parseInt(req.query.qty as string) || 1;

        // 1. Chỉ mất 0.001s để lấy con số này từ Redis
        const availableCountStr = await redisClient.get(`event:${event_id}:show:${show_id}:zone:${zone_id}:available`);
        const availableCount = typeof availableCountStr === "string" ? parseInt(availableCountStr, 10) : 0;

        // 2. Trả kết quả về cho Frontend
        if (availableCount >= requestedQty) {
            res.status(200).json({ isAvailable: true, availableCount });
        } else {
            res.status(200).json({
                isAvailable: false,
                message: `Rất tiếc, khu vực này chỉ còn lại ${availableCount} vé.`
            });
        }
    } catch (error) {
        res.status(500).json({ error: "Lỗi kiểm tra số lượng vé" });
    }
};