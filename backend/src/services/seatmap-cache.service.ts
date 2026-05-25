import * as cheerio from 'cheerio';
import mongoose, { ClientSession, Types } from 'mongoose';
import Show from '../models/show.model';
import Zone from '../models/zone.model';
import Seat from '../models/seat.model';
import TicketType from '../models/ticket-type.model';
import Order from '../models/order.model';
import redisClient from '../utils/redisClient';
import { calculateValidQuantities } from '../utils/validQuantities';

const SHOW_CACHE_TTL_SECONDS = 86400;

type TicketTypeInput = {
    name: string;
    price: number;
    target_tier: string;
    [key: string]: any;
};

const normalizeId = (value: any): string => value?._id?.toString?.() || value?.toString?.() || String(value);

const parseJsonIfNeeded = <T>(value: unknown, fallback: T): T => {
    if (!value) return fallback;
    if (typeof value !== 'string') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

export const parseMapAssetsFromSvg = (stadiumMapSvg?: string) => {
    const mapAssets: Array<{ asset_id: string; path_data: string }> = [];
    if (!stadiumMapSvg) return mapAssets;

    const $ = cheerio.load(stadiumMapSvg, { xmlMode: true });
    $('[id^="asset_"]').each((_, element) => {
        const assetId = $(element).attr('id');
        if (!assetId) return;

        const pathElement = $(element).is('path') ? $(element) : $(element).find('path').first();
        const pathData = pathElement.attr('d') || '';
        if (pathData) {
            mapAssets.push({ asset_id: assetId, path_data: pathData });
        }
    });

    return mapAssets;
};

export const hasBlockingOrdersForShow = async (showId: string) => {
    return Order.exists({
        show_id: showId,
        status: { $in: ['pending', 'confirmed'] }
    });
};

export const purgeShowRedisCache = async (showId: string) => {
    const show = await Show.findById(showId).select('_id event_id').lean();
    if (!show) return;

    const zones = await Zone.find({ show_id: showId }).select('_id').lean();
    const seats = await Seat.find({ show_id: showId }).select('_id').lean();
    const pipeline = redisClient.multi();
    const eventId = normalizeId(show.event_id);

    for (const zone of zones) {
        const zoneId = normalizeId(zone._id);
        pipeline.del(`event:${eventId}:show:${showId}:zone:${zoneId}:summary`);

        const zoneSeats = await Seat.find({ show_id: showId, zone_id: zone._id }).select('row').lean();
        const rows = Array.from(new Set(zoneSeats.map((seat: any) => seat.row).filter(Boolean)));
        for (const rowLabel of rows) {
            pipeline.del(`event:${eventId}:show:${showId}:zone:${zoneId}:row:${rowLabel}`);
        }
    }

    for (const seat of seats) {
        pipeline.del(`event:${eventId}:show:${showId}:seat:${normalizeId(seat._id)}:lock`);
    }

    pipeline.del(`show:${showId}:ticket_types`);
    pipeline.del(`show:${showId}:seats_static_layout`);
    pipeline.del(`show:${showId}:seat_status`);
    pipeline.del(`event:${eventId}:show:${showId}:sale_start`);
    pipeline.del(`event:${eventId}:show:${showId}:sale_end`);
    pipeline.del(`event:${eventId}:show:${showId}:holding_seats`);
    pipeline.del(`event:${eventId}:show:${showId}:total_revenue`);
    pipeline.del(`event:${eventId}:show:${showId}:sold_count`);

    await pipeline.exec();
};

export const rebuildShowRedisCache = async (showId: string) => {
    const show = await Show.findById(showId).lean();
    if (!show) throw new Error('Show không tồn tại.');

    const zones = await Zone.find({ show_id: showId }).lean();
    const seats = await Seat.find({ show_id: showId }).lean();
    const ticketTypes = await TicketType.find({ show_id: showId }).lean();
    const eventId = normalizeId(show.event_id);
    const pipeline = redisClient.multi();

    pipeline.set(`event:${eventId}:show:${showId}:sale_start`, new Date(show.sale_start).toISOString());
    pipeline.set(`event:${eventId}:show:${showId}:sale_end`, new Date(show.sale_end).toISOString());

    pipeline.set(
        `show:${showId}:ticket_types`,
        JSON.stringify(ticketTypes.map((ticketType: any) => ({
            id: normalizeId(ticketType._id),
            name: ticketType.name,
            price: ticketType.price,
            target_tier: ticketType.target_tier
        })))
    );

    pipeline.set(`show:${showId}:seats_static_layout`, JSON.stringify(seats), { EX: SHOW_CACHE_TTL_SECONDS });
    pipeline.del(`show:${showId}:seat_status`);

    for (const seat of seats as any[]) {
        if (seat.status && seat.status !== 'available') {
            pipeline.hSet(`show:${showId}:seat_status`, normalizeId(seat._id), seat.status);
        }
    }

    for (const zone of zones as any[]) {
        const zoneId = normalizeId(zone._id);
        const zoneSeats = (seats as any[]).filter(seat => normalizeId(seat.zone_id) === zoneId);
        const seatsByRow: Record<string, any[]> = {};
        const countByTicketType: Record<string, number> = {};
        const rowStrings: string[] = [];
        const summaryKey = `event:${eventId}:show:${showId}:zone:${zoneId}:summary`;

        for (const seat of zoneSeats) {
            if (!seatsByRow[seat.row]) seatsByRow[seat.row] = [];
            seatsByRow[seat.row].push(seat);
        }

        pipeline.del(summaryKey);

        for (const [rowLabel, rowSeats] of Object.entries(seatsByRow)) {
            rowSeats.sort((a, b) => Number(a.col_index) - Number(b.col_index));
            const maxCol = Math.max(...rowSeats.map(seat => Number(seat.col_index || 0)), 0);
            const rowArray = Array(maxCol).fill('X');

            for (const seat of rowSeats) {
                const status = seat.status || 'available';
                const index = Number(seat.col_index) - 1;
                if (index < 0) continue;

                if (status === 'available') {
                    rowArray[index] = 'O';
                    const ticketTypeId = normalizeId(seat.ticket_type_id);
                    if (ticketTypeId && ticketTypeId !== 'null' && ticketTypeId !== 'undefined') {
                        countByTicketType[ticketTypeId] = (countByTicketType[ticketTypeId] || 0) + 1;
                    }
                } else if (status === 'holding') {
                    rowArray[index] = 'H';
                } else {
                    rowArray[index] = 'S';
                }
            }

            const rowString = rowArray.join('');
            rowStrings.push(rowString);
            pipeline.set(`event:${eventId}:show:${showId}:zone:${zoneId}:row:${rowLabel}`, rowString);
        }

        pipeline.hSet(summaryKey, 'valid_quantities', JSON.stringify(calculateValidQuantities(rowStrings)));

        for (const ticketType of ticketTypes as any[]) {
            const ticketTypeId = normalizeId(ticketType._id);
            pipeline.hSet(summaryKey, `tier:${ticketTypeId}:count`, String(countByTicketType[ticketTypeId] || 0));
            pipeline.hSet(summaryKey, `tier:${ticketTypeId}:price`, String(ticketType.price || 0));
        }
    }

    await pipeline.exec();
};

export const regenerateSeatmapFromSvg = async (params: {
    showId: string;
    stadiumMapSvg: string;
    ticketTypes?: TicketTypeInput[] | string;
    session?: ClientSession;
}) => {
    const { showId, stadiumMapSvg, session } = params;
    const show = await Show.findById(showId).session(session || null);
    if (!show) throw new Error('Show không tồn tại.');

    const parsedTicketTypes = parseJsonIfNeeded<TicketTypeInput[]>(params.ticketTypes, []);
    const mapAssets = parseMapAssetsFromSvg(stadiumMapSvg);

    if (parsedTicketTypes.length > 0) {
        await TicketType.deleteMany({ show_id: showId }).session(session || null);
        await TicketType.insertMany(
            parsedTicketTypes.map(ticketType => ({
                ...ticketType,
                event_id: show.event_id,
                show_id: show._id
            })),
            { session }
        );
    }

    const ticketTypesFromDb = await TicketType.find({ show_id: showId }).session(session || null);
    const tierToTicketType = new Map<string, any>();
    for (const ticketType of ticketTypesFromDb as any[]) {
        tierToTicketType.set(String(ticketType.target_tier).toUpperCase(), ticketType);
    }

    await Seat.deleteMany({ show_id: showId }).session(session || null);
    await Zone.deleteMany({ show_id: showId }).session(session || null);

    const $ = cheerio.load(stadiumMapSvg, { xmlMode: true });
    const zoneDrafts: any[] = [];
    const parsedZonesData: Array<{ rowsMap: Map<string, any[]> }> = [];

    $('g[id^="zone_"]').each((_, zoneGroup) => {
        const svgId = $(zoneGroup).attr('id');
        if (!svgId) return;

        const formattedName = svgId.replace('zone_', '').replace(/_/g, ' ');
        let pathElement = $(zoneGroup).find('[id^="zone_area"]').first();
        if (pathElement.length === 0) pathElement = $(zoneGroup).find('path').first();
        const pathData = pathElement.attr('d') || '';
        const rowsMap = new Map<string, any[]>();

        $(zoneGroup).find('g[id^="Type-"]').each((_, typeGroup) => {
            const typeId = $(typeGroup).attr('id') || '';
            const typeName = typeId.replace(/^Type-/, '').split(/[-_]/)[0].toUpperCase();

            $(typeGroup).find('g[id*="row-" i], g[id*="Row-"]').each((__, rowGroup) => {
                const rowIdAttr = $(rowGroup).attr('id') || '';
                const matchRow = rowIdAttr.match(/row-([a-zA-Z0-9]+)/i);
                if (!matchRow) return;

                const rowName = matchRow[1].toUpperCase();
                if (!rowsMap.has(rowName)) rowsMap.set(rowName, []);

                $(rowGroup).find('g[id*="seat-" i], g[id*="Seat-"]').each((___, seatGroup: any) => {
                    const seatIdAttr = $(seatGroup).attr('id') || '';
                    const matchSeat = seatIdAttr.match(/seat-([a-zA-Z0-9]+)/i);
                    if (!matchSeat) return;

                    const seatNumber = parseInt(matchSeat[1], 10);
                    const circle = $(seatGroup).find('circle').first();
                    if (Number.isNaN(seatNumber) || circle.length === 0) return;

                    rowsMap.get(rowName)!.push({
                        seat_number_val: seatNumber,
                        x: parseFloat(circle.attr('cx') || '0'),
                        y: parseFloat(circle.attr('cy') || '0'),
                        tier: typeName
                    });
                });
            });
        });

        zoneDrafts.push({
            event_id: show.event_id,
            show_id: show._id,
            name: formattedName,
            overall_map_svg_id: svgId,
            path_data: pathData,
            capacity: 0
        });
        parsedZonesData.push({ rowsMap });
    });

    const createdZones = await Zone.insertMany(zoneDrafts, { session });
    const seatsToInsert: any[] = [];

    createdZones.forEach((zone: any, index) => {
        const { rowsMap } = parsedZonesData[index];
        let capacity = 0;

        for (const [rowName, circles] of rowsMap.entries()) {
            circles.sort((a, b) => a.seat_number_val - b.seat_number_val);
            for (const circle of circles) {
                const ticketType = tierToTicketType.get(String(circle.tier).toUpperCase());
                seatsToInsert.push({
                    zone_id: zone._id,
                    event_id: show.event_id,
                    show_id: show._id,
                    tier: circle.tier,
                    row: rowName,
                    col_index: circle.seat_number_val,
                    seat_number: `${rowName}-${circle.seat_number_val}`,
                    x: circle.x,
                    y: circle.y,
                    status: 'available',
                    ticket_type_id: ticketType?._id || null
                });
                capacity++;
            }
        }

        zone.capacity = capacity;
    });

    if (seatsToInsert.length > 0) {
        await Seat.insertMany(seatsToInsert, { session });
    }

    await Promise.all(createdZones.map((zone: any) => zone.save({ session })));

    show.stadium_map_svg = stadiumMapSvg;
    show.map_assets = mapAssets;
    await show.save({ session });

    return {
        zones: createdZones,
        total_seats_generated: seatsToInsert.length
    };
};

export const regenerateSeatmapWithTransaction = async (params: {
    showId: string;
    stadiumMapSvg: string;
    ticketTypes?: TicketTypeInput[] | string;
}) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const result = await regenerateSeatmapFromSvg({ ...params, session });
        await session.commitTransaction();
        await rebuildShowRedisCache(params.showId);
        return result;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};
