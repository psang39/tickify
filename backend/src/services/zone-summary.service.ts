import redisClient from '../utils/redisClient';
import { calculateValidQuantities } from '../utils/validQuantities';
import { formatHashToJSON } from '../utils/hashToJson';

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
