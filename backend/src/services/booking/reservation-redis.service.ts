import redisClient from '../../utils/redisClient';
import { measureRedisCommandAttribution } from '../redis-attribution.service';

export const HOLD_DURATION_SECONDS = 600;

export const holdSeatsLuaScript = `
    local rowKey = KEYS[1]
    local userCountKey = KEYS[2]
    local lockTTL = tonumber(ARGV[1])
    local userId = ARGV[2]
    local numSeats = #KEYS - 2
    local currentHeldCount = tonumber(redis.call('GET', userCountKey) or 0)
    if currentHeldCount + numSeats > 4 then return redis.error_reply("EXCEED_MAX_TICKETS_LIMIT") end
    local rowStr = redis.call('GET', rowKey)
    if not rowStr then return redis.error_reply("ROW_NOT_FOUND") end
    local chars = {}
    for i = 1, #rowStr do chars[i] = rowStr:sub(i, i) end
    for i = 1, numSeats do
        local seatColIndex = tonumber(ARGV[2 + i])
        if chars[seatColIndex] ~= 'O' then return redis.error_reply("SEAT_UNAVAILABLE") end
        chars[seatColIndex] = 'H'
    end
    local newRowStr = table.concat(chars)
    local checkStr = newRowStr:gsub("H", "X")
    local paddedStr = "X" .. checkStr .. "X"
    if string.find(paddedStr, "XOX") then return redis.error_reply("ORPHAN_SEAT_VIOLATION") end
    redis.call('SET', rowKey, newRowStr)
    for i = 3, #KEYS do redis.call('SET', KEYS[i], userId, 'EX', lockTTL) end
    redis.call('INCRBY', userCountKey, numSeats)
    redis.call('EXPIRE', userCountKey, lockTTL)
    return rowStr
`;

export const holdStandingSeatsLuaScript = `
    local rowKey = KEYS[1]
    local userCountKey = KEYS[2]
    local lockTTL = tonumber(ARGV[1])
    local userId = ARGV[2]
    local numSeats = #KEYS - 2
    local currentHeldCount = tonumber(redis.call('GET', userCountKey) or 0)
    if currentHeldCount + numSeats > 4 then return redis.error_reply("EXCEED_MAX_TICKETS_LIMIT") end
    local rowStr = redis.call('GET', rowKey)
    if not rowStr then return redis.error_reply("ROW_NOT_FOUND") end
    local chars = {}
    for i = 1, #rowStr do chars[i] = rowStr:sub(i, i) end
    for i = 1, numSeats do
        local seatColIndex = tonumber(ARGV[2 + i])
        if chars[seatColIndex] ~= 'O' then return redis.error_reply("SEAT_UNAVAILABLE") end
        chars[seatColIndex] = 'H'
    end
    redis.call('SET', rowKey, table.concat(chars))
    for i = 3, #KEYS do redis.call('SET', KEYS[i], userId, 'EX', lockTTL) end
    redis.call('INCRBY', userCountKey, numSeats)
    redis.call('EXPIRE', userCountKey, lockTTL)
    return rowStr
`;

const rollbackLuaScript = `
    local userCountKey = KEYS[1]
    local userId = ARGV[1]
    local numSeats = tonumber(ARGV[2]) or 0
    for i = 1, numSeats do
        local lockKey = KEYS[i + 1]
        if lockKey and redis.call("GET", lockKey) == userId then redis.call("DEL", lockKey) end
    end
    local numRows = #KEYS - (numSeats + 1)
    for i = 1, numRows do
        local rowKey = KEYS[numSeats + 1 + i]
        local prevString = ARGV[3 + i]
        if rowKey and prevString then redis.call("SET", rowKey, prevString) end
    end
    local rawCount = redis.call("GET", userCountKey)
    local currentCount = tonumber(rawCount) or 0
    if currentCount > 0 and numSeats > 0 then
        if currentCount >= numSeats then
            local nextCount = currentCount - numSeats
            if nextCount > 0 then
                redis.call("SET", userCountKey, nextCount)
                redis.call("EXPIRE", userCountKey, tonumber(ARGV[3]) or 600)
            else redis.call("DEL", userCountKey) end
        else redis.call("DEL", userCountKey) end
    end
    return "OK"
`;

export interface ModifiedRow {
    rowLabel: string;
    prevString: string;
}

export const buildRowHoldCommand = (params: {
    eventId: string;
    showId: string;
    zoneId: string;
    userId: string;
    rowLabel: string;
    seats: Array<{ _id: { toString(): string }; col_index: number }>;
}) => {
    const { eventId, showId, zoneId, userId, rowLabel, seats } = params;
    const keys = [
        `event:${eventId}:show:${showId}:zone:${zoneId}:row:${rowLabel}`,
        `event:${eventId}:show:${showId}:user:${userId}:held_count`,
    ];
    const args = [String(HOLD_DURATION_SECONDS), userId];
    seats.forEach(seat => {
        keys.push(`event:${eventId}:show:${showId}:seat:${seat._id}:lock`);
        args.push(String(seat.col_index));
    });
    return { keys, args };
};

export const holdReservationRow = async (params: {
    isStanding: boolean;
    keys: string[];
    args: string[];
}): Promise<unknown> => measureRedisCommandAttribution(
    'hold-eval',
    () => redisClient.eval(
        params.isStanding ? holdStandingSeatsLuaScript : holdSeatsLuaScript,
        { keys: params.keys, arguments: params.args },
    ),
);

export const rollbackLocksAndRows = async (
    eventId: string,
    showId: string,
    zoneId: string,
    userId: string,
    lockedSeatIds: string[],
    modifiedRows: ModifiedRow[],
): Promise<void> => {
    if (lockedSeatIds.length === 0 && modifiedRows.length === 0) return;
    const keys = [`event:${eventId}:show:${showId}:user:${userId}:held_count`];
    const args = [userId, lockedSeatIds.length.toString(), HOLD_DURATION_SECONDS.toString()];
    lockedSeatIds.forEach(seatId => keys.push(`event:${eventId}:show:${showId}:seat:${seatId}:lock`));
    modifiedRows.forEach(row => {
        keys.push(`event:${eventId}:show:${showId}:zone:${zoneId}:row:${row.rowLabel}`);
        args.push(row.prevString);
    });
    try {
        await redisClient.eval(rollbackLuaScript, { keys, arguments: args });
        for (const seatId of lockedSeatIds) {
            await redisClient.publish('SEAT_UPDATES', JSON.stringify({ show_id: showId, seat_id: seatId, status: 'available' }));
        }
        console.log(`[Rollback Success] Đã nhả ${lockedSeatIds.length} ghế và khôi phục ${modifiedRows.length} hàng.`);
    } catch (error) {
        console.error('[Rollback Error] Lỗi nghiêm trọng khi dọn dẹp Redis:', error);
    }
};

// Explicit user release preserves the legacy behavior of reopening each supplied
// column after its durable pending -> cancelled transition has won.
export const releaseSeatsLuaScript = `
    local rowKey = KEYS[1]
    local userCountKey = KEYS[2]
    local lockCount = tonumber(ARGV[1]) or 0
    local rowStr = redis.call('GET', rowKey)
    if not rowStr then return nil end
    local chars = {}
    for i = 1, #rowStr do chars[i] = rowStr:sub(i, i) end
    for i = 1, lockCount do
        local colIndex = tonumber(ARGV[1 + i])
        chars[colIndex] = 'O'
    end
    local newRowStr = table.concat(chars)
    redis.call('SET', rowKey, newRowStr)
    for i = 1, lockCount do redis.call('DEL', KEYS[2 + i]) end
    if lockCount > 0 then
        local currentCount = tonumber(redis.call('GET', userCountKey) or 0)
        if currentCount >= lockCount then redis.call('DECRBY', userCountKey, lockCount)
        else redis.call('SET', userCountKey, 0) end
    end
    local summaryKey = KEYS[3 + lockCount]
    local releasedByTier = {}
    for i = 1, lockCount do
        local ticketTypeId = ARGV[1 + lockCount + i]
        if ticketTypeId and ticketTypeId ~= '' then
            releasedByTier[ticketTypeId] = (releasedByTier[ticketTypeId] or 0) + 1
        end
    end
    for ticketTypeId, count in pairs(releasedByTier) do
        redis.call('HINCRBY', summaryKey, 'tier:' .. ticketTypeId .. ':count', count)
    end
    local validSet = {}
    for chunk in string.gmatch(newRowStr, 'O+') do
        local maxQuantity = math.min(#chunk, 4)
        for quantity = 1, maxQuantity do
            if #chunk - quantity ~= 1 then validSet[quantity] = true end
        end
    end
    local validQuantities = {}
    for quantity = 1, 4 do if validSet[quantity] then table.insert(validQuantities, quantity) end end
    if #validQuantities == 0 then redis.call('HSET', summaryKey, 'valid_quantities', '[]')
    else redis.call('HSET', summaryKey, 'valid_quantities', cjson.encode(validQuantities)) end
    return newRowStr
`;

export const releaseReservationRows = async (params: {
    eventId: string;
    showId: string;
    zoneId: string;
    userId: string;
    seatsByRow: Record<string, Array<{
        _id: { toString(): string };
        col_index: number;
        ticket_type_id?: { toString(): string } | null;
    }>>;
}): Promise<void> => {
    const { eventId, showId, zoneId, userId, seatsByRow } = params;
    for (const rowLabel in seatsByRow) {
        const seatsInRow = seatsByRow[rowLabel];
        const keys = [
            `event:${eventId}:show:${showId}:zone:${zoneId}:row:${rowLabel}`,
            `event:${eventId}:show:${showId}:user:${userId}:held_count`,
        ];
        const args: string[] = [String(seatsInRow.length)];
        seatsInRow.forEach(seat => {
            keys.push(`event:${eventId}:show:${showId}:seat:${seat._id}:lock`);
            args.push(String(seat.col_index));
        });
        keys.push(`event:${eventId}:show:${showId}:zone:${zoneId}:summary`);
        seatsInRow.forEach(seat => args.push(seat.ticket_type_id?.toString?.() || ''));
        await redisClient.eval(releaseSeatsLuaScript, { keys, arguments: args });
    }
};
