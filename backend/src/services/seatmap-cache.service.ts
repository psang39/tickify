import * as cheerio from 'cheerio';
import mongoose, { ClientSession } from 'mongoose';
import Show from '../models/show.model';
import Zone from '../models/zone.model';
import Seat from '../models/seat.model';
import TicketType from '../models/ticket-type.model';
import Order from '../models/order.model';
import redisClient from '../utils/redisClient';
import { calculateValidQuantities } from '../utils/validQuantities';

const SHOW_CACHE_TTL_SECONDS = 86400;
const STANDING_ROW_LABEL = 'GA';
const STANDING_ALIASES = ['GA', 'GENERALADMISSION', 'GENERAL_ADMISSION', 'STANDING', 'STAND', 'FLOOR', 'PIT', 'GADUNG'];

type TicketTypeInput = {
    name: string;
    price: number;
    target_tier: string;
    total_quantity?: number | null;
    [key: string]: any;
};

type ParsedSeat = {
    seat_number_val: number;
    x: number;
    y: number;
    tier: string;
};

type ParsedZoneData = {
    rowsMap: Map<string, ParsedSeat[]>;
    isStanding: boolean;
    standingTier: string | null;
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

const normalizeToken = (value?: string | null) => String(value || '')
    .replace(/^Type-/i, '')
    .replace(/^type-/i, '')
    .replace(/^zone_/i, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

export const isStandingToken = (value?: string | null) => {
    const normalized = normalizeToken(value);
    if (!normalized) return false;
    return STANDING_ALIASES.some(alias => normalized === alias || normalized.includes(alias));
};

const getTypeNameFromTypeId = (typeId: string) => {
    const raw = typeId.replace(/^Type-/i, '').trim();
    const firstSegment = raw.split(/[-_\s]/)[0];
    return (firstSegment || raw || 'DEFAULT').toUpperCase();
};

const findTicketTypeByTier = (ticketTypes: any[], tier?: string | null) => {
    if (!tier) return null;
    const normalizedTier = normalizeToken(tier);
    return ticketTypes.find(ticketType => normalizeToken(ticketType.target_tier) === normalizedTier) || null;
};

const findStandingTicketType = (ticketTypes: any[], preferredTier?: string | null) => {
    const preferred = findTicketTypeByTier(ticketTypes, preferredTier);
    if (preferred) return preferred;
    return ticketTypes.find(ticketType => isStandingToken(ticketType.target_tier) || isStandingToken(ticketType.name)) || null;
};

const buildStandingSeats = (params: {
    zone: any;
    ticketType: any;
    eventId: any;
    showId: any;
    capacity: number;
}) => {
    const { zone, ticketType, eventId, showId, capacity } = params;
    return Array.from({ length: capacity }, (_, index) => {
        const colIndex = index + 1;
        return {
            zone_id: zone._id,
            event_id: eventId,
            show_id: showId,
            tier: ticketType?.target_tier || STANDING_ROW_LABEL,
            row: STANDING_ROW_LABEL,
            col_index: colIndex,
            seat_number: `${STANDING_ROW_LABEL}-${('0000' + colIndex).slice(-4)}`,
            status: 'available',
            ticket_type_id: ticketType?._id || null
        };
    });
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
    const seats = await Seat.find({ show_id: showId }).select('_id row zone_id').lean();
    const pipeline = redisClient.multi();
    const eventId = normalizeId(show.event_id);

    for (const zone of zones) {
        const zoneId = normalizeId(zone._id);
        pipeline.del(`event:${eventId}:show:${showId}:zone:${zoneId}:summary`);
        const rows = Array.from(new Set((seats as any[])
            .filter(seat => normalizeId(seat.zone_id) === zoneId)
            .map(seat => seat.row)
            .filter(Boolean)));
        for (const rowLabel of rows) {
            pipeline.del(`event:${eventId}:show:${showId}:zone:${zoneId}:row:${rowLabel}`);
        }
    }

    for (const seat of seats as any[]) {
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
            target_tier: ticketType.target_tier,
            total_quantity: ticketType.total_quantity ?? null
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
        pipeline.hSet(summaryKey, 'is_standing', zone.is_standing ? 'true' : 'false');
        if (zone.ticket_type_id) pipeline.hSet(summaryKey, 'ticket_type_id', normalizeId(zone.ticket_type_id));

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

        pipeline.hSet(summaryKey, 'valid_quantities', JSON.stringify(zone.is_standing ? { 1: true, 2: true, 3: true, 4: true } : calculateValidQuantities(rowStrings)));

        for (const ticketType of ticketTypes as any[]) {
            const ticketTypeId = normalizeId(ticketType._id);
            pipeline.hSet(summaryKey, `tier:${ticketTypeId}:count`, String(countByTicketType[ticketTypeId] || 0));
            pipeline.hSet(summaryKey, `tier:${ticketTypeId}:price`, String(ticketType.price || 0));
        }
    }

    await pipeline.exec();
};

const parseZonesFromSvg = (stadiumMapSvg: string) => {
    const $ = cheerio.load(stadiumMapSvg, { xmlMode: true });
    const zones: Array<{
        svgId: string;
        name: string;
        pathData: string;
        parsedData: ParsedZoneData;
    }> = [];

    $('g[id^="zone_"]').each((_, zoneGroup) => {
        const svgId = $(zoneGroup).attr('id');
        if (!svgId) return;

        const formattedName = svgId.replace('zone_', '').replace(/_/g, ' ');
        let pathElement = $(zoneGroup).find('[id^="zone_area"]').first();
        if (pathElement.length === 0) pathElement = $(zoneGroup).find('path').first();
        const pathData = pathElement.attr('d') || '';
        const rowsMap = new Map<string, ParsedSeat[]>();
        const zoneLooksStanding = isStandingToken(svgId) || isStandingToken(formattedName);
        let standingTier: string | null = zoneLooksStanding ? 'GA' : null;
        let hasSeatNodes = false;

        $(zoneGroup).find('g[id^="Type-"]').each((_, typeGroup) => {
            const typeId = $(typeGroup).attr('id') || '';
            const typeName = getTypeNameFromTypeId(typeId);
            if (isStandingToken(typeId) || isStandingToken(typeName)) {
                standingTier = typeName || standingTier || 'GA';
            }

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

                    hasSeatNodes = true;
                    rowsMap.get(rowName)!.push({
                        seat_number_val: seatNumber,
                        x: parseFloat(circle.attr('cx') || '0'),
                        y: parseFloat(circle.attr('cy') || '0'),
                        tier: typeName
                    });
                });
            });
        });

        const isStanding = Boolean(zoneLooksStanding || (standingTier && isStandingToken(standingTier)));
        zones.push({
            svgId,
            name: formattedName,
            pathData,
            parsedData: { rowsMap, isStanding, standingTier: standingTier || null }
        });
    });

    return zones;
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
        tierToTicketType.set(normalizeToken(ticketType.target_tier), ticketType);
    }

    await Seat.deleteMany({ show_id: showId }).session(session || null);
    await Zone.deleteMany({ show_id: showId }).session(session || null);

    const parsedZones = parseZonesFromSvg(stadiumMapSvg);
    const zoneDrafts = parsedZones.map(zone => {
        const standingTicketType = zone.parsedData.isStanding
            ? findStandingTicketType(ticketTypesFromDb as any[], zone.parsedData.standingTier)
            : null;
        return {
            event_id: show.event_id,
            show_id: show._id,
            name: zone.name,
            overall_map_svg_id: zone.svgId,
            path_data: zone.pathData,
            capacity: 0,
            is_standing: zone.parsedData.isStanding,
            ticket_type_id: standingTicketType?._id || undefined
        };
    });

    const createdZones = await Zone.insertMany(zoneDrafts, { session });
    const seatsToInsert: any[] = [];

    createdZones.forEach((zone: any, index) => {
        const { rowsMap, isStanding, standingTier } = parsedZones[index].parsedData;
        let capacity = 0;

        if (isStanding) {
            const ticketType = findStandingTicketType(ticketTypesFromDb as any[], standingTier);
            capacity = Number(ticketType?.total_quantity || 0);
            zone.capacity = capacity;
            zone.ticket_type_id = ticketType?._id || zone.ticket_type_id;
            if (capacity > 0) {
                seatsToInsert.push(...buildStandingSeats({
                    zone,
                    ticketType,
                    eventId: show.event_id,
                    showId: show._id,
                    capacity
                }));
            }
            return;
        }

        for (const [rowName, circles] of rowsMap.entries()) {
            circles.sort((a, b) => a.seat_number_val - b.seat_number_val);
            for (const circle of circles) {
                const ticketType = tierToTicketType.get(normalizeToken(circle.tier));
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
