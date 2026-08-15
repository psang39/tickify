import redisClient from '../utils/redisClient';
import { calculateValidQuantities } from '../utils/validQuantities';
import { formatHashToJSON } from '../utils/hashToJson';

const finalizeReleasedSeatMetadataLua = `
    local statusHashKey = KEYS[1]
    local holdingSetKey = KEYS[2]
    local seatCount = tonumber(ARGV[1]) or 0
    local safeSeatIds = {}
    local offset = 2

    for i = 1, seatCount do
        local seatId = ARGV[offset]
        local rowKey = ARGV[offset + 1]
        local colIndex = tonumber(ARGV[offset + 2])
        local lockKey = ARGV[offset + 3]
        offset = offset + 5

        local row = redis.call('GET', rowKey)
        local isStillOpen = row
            and row:sub(colIndex, colIndex) == 'O'
            and redis.call('EXISTS', lockKey) == 0

        if isStillOpen then
            redis.call('HDEL', statusHashKey, seatId)
            redis.call('SREM', holdingSetKey, seatId)
            table.insert(safeSeatIds, seatId)
        end
    end

    return safeSeatIds
`;

export interface ReleasedSeatMetadata {
    id: string;
    row: string;
    colIndex: number;
    ticketTypeId: string | null;
}

export const finalizeReleasedSeatMetadata = async (params: {
    eventId: string;
    showId: string;
    zoneId: string;
    seats: ReleasedSeatMetadata[];
}) => {
    const { eventId, showId, zoneId, seats } = params;
    const statusHashKey = `show:${showId}:seat_status`;
    const holdingSetKey = `event:${eventId}:show:${showId}:holding_seats`;
    const summaryKey = `event:${eventId}:show:${showId}:zone:${zoneId}:summary`;
    const argumentsList = [String(seats.length)];

    for (const seat of seats) {
        argumentsList.push(
            seat.id,
            `event:${eventId}:show:${showId}:zone:${zoneId}:row:${seat.row}`,
            String(seat.colIndex),
            `event:${eventId}:show:${showId}:seat:${seat.id}:lock`,
            seat.ticketTypeId || '',
        );
    }

    const releasedSeatIds = await redisClient.eval(finalizeReleasedSeatMetadataLua, {
        keys: [statusHashKey, holdingSetKey, summaryKey],
        arguments: argumentsList,
    }) as string[];

    const updatedHash = await redisClient.hGetAll(summaryKey);
    const summary = formatHashToJSON(updatedHash);
    await redisClient.publish('ZONE_SUMMARY_UPDATES', JSON.stringify({ zone_id: zoneId, summary }));

    return { releasedSeatIds, summary };
};

export const updateZoneSummaryAfterHold = async (params: {
    eventId: string;
    showId: string;
    zoneId: string;
    modifiedRows: Array<{ rowLabel: string }>;
    lockedByTicketType: Record<string, number>;
    seatIds: string[];
}) => {
    const { eventId, showId, zoneId, modifiedRows, lockedByTicketType, seatIds } = params;
    const holdingSetKey = `event:${eventId}:show:${showId}:holding_seats`;
    const summaryKey = `event:${eventId}:show:${showId}:zone:${zoneId}:summary`;
    const rowKeys = modifiedRows.map(row => `event:${eventId}:show:${showId}:zone:${zoneId}:row:${row.rowLabel}`);
    const updatedRowStrings = rowKeys.length > 0 ? await redisClient.mGet(rowKeys) as string[] : [];
    const pipeline = redisClient.multi();

    for (const [ticketTypeId, lockedCount] of Object.entries(lockedByTicketType)) {
        pipeline.hIncrBy(summaryKey, `tier:${ticketTypeId}:count`, -lockedCount);
    }

    pipeline.hSet(summaryKey, 'valid_quantities', JSON.stringify(calculateValidQuantities(updatedRowStrings.filter(Boolean))));
    if (seatIds.length > 0) pipeline.sAdd(holdingSetKey, seatIds);
    await pipeline.exec();

    const updatedHash = await redisClient.hGetAll(summaryKey);
    const summary = formatHashToJSON(updatedHash);

    await redisClient.publish('ZONE_SUMMARY_UPDATES', JSON.stringify({
        zone_id: zoneId,
        summary
    }));

    return summary;
};

export const updateZoneSummaryAfterRelease = async (params: {
    eventId: string;
    showId: string;
    zoneId: string;
    updatedRowStrings: string[];
    releasedByTicketType: Record<string, number>;
    seatIds: string[];
}) => {
    const { eventId, showId, zoneId, updatedRowStrings, releasedByTicketType, seatIds } = params;
    const summaryKey = `event:${eventId}:show:${showId}:zone:${zoneId}:summary`;
    const holdingSetKey = `event:${eventId}:show:${showId}:holding_seats`;
    const pipeline = redisClient.multi();

    if (seatIds.length > 0) pipeline.sRem(holdingSetKey, seatIds);

    for (const [ticketTypeId, releasedCount] of Object.entries(releasedByTicketType)) {
        pipeline.hIncrBy(summaryKey, `tier:${ticketTypeId}:count`, releasedCount);
    }

    if (updatedRowStrings.length > 0) {
        pipeline.hSet(summaryKey, 'valid_quantities', JSON.stringify(calculateValidQuantities(updatedRowStrings.filter(Boolean))));
    }

    await pipeline.exec();

    const updatedHash = await redisClient.hGetAll(summaryKey);
    const summary = formatHashToJSON(updatedHash);

    await redisClient.publish('ZONE_SUMMARY_UPDATES', JSON.stringify({
        zone_id: zoneId,
        summary
    }));

    return summary;
};
