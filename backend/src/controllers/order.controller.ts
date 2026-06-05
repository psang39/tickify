import { Request, Response } from 'express';
import redisClient from '../utils/redisClient';
import Order from '../models/order.model';
import Seat from '../models/seat.model';
import Zone from '../models/zone.model';
import User from '../models/user.model';
import TicketType from '../models/ticket-type.model';
import Show from '../models/show.model';
import Ticket from '../models/ticket.model';
import { orderExpirationQueue } from '../queues/orderExpiration.queue';
import { calculateValidQuantities } from '../utils/validQuantities';
import { formatHashToJSON } from '../utils/hashToJson';
import { updateZoneSummaryAfterHold, updateZoneSummaryAfterRelease } from '../services/zone-summary.service';
import Attendee from '../models/attendee.model';


const HOLD_DURATION_SECONDS = 600;

const holdSeatsLuaScript = `
    local rowKey = KEYS[1]
    local userCountKey = KEYS[2]
    local lockTTL = tonumber(ARGV[1])
    local userId = ARGV[2]

    -- 1. KIỂM TRA GIỚI HẠN VÉ CỦA USER (Tối đa 4 vé)
    local numSeats = #KEYS - 2 -- Số lượng ghế đang muốn giữ ở request này
    local currentHeldCount = tonumber(redis.call('GET', userCountKey) or 0)

    if currentHeldCount + numSeats > 4 then
        return redis.error_reply("EXCEED_MAX_TICKETS_LIMIT")
    end

    -- 2. Đọc chuỗi trạng thái Hàng hiện tại
    local rowStr = redis.call('GET', rowKey)
    if not rowStr then
        return redis.error_reply("ROW_NOT_FOUND")
    end

    local chars = {}
    for i = 1, #rowStr do
        chars[i] = rowStr:sub(i, i)
    end

    -- 3. Kiểm tra ghế trống và đổi thành 'H'
    for i = 1, numSeats do
        -- Lấy colIndex từ ARGV[3], ARGV[4]... tương ứng với số ghế
        local seatColIndex = tonumber(ARGV[2 + i])
        if chars[seatColIndex] ~= 'O' then
            return redis.error_reply("SEAT_UNAVAILABLE")
        end
        chars[seatColIndex] = 'H' 
    end

    -- 4. Validate ghế mồ côi (Tìm XOX)
    local newRowStr = table.concat(chars)
    local checkStr = newRowStr:gsub("H", "X")
    local paddedStr = "X" .. checkStr .. "X"

    if string.find(paddedStr, "XOX") then
        return redis.error_reply("ORPHAN_SEAT_VIOLATION")
    end

    -- 5. NẾU MỌI THỨ OK -> TIẾN HÀNH GHI ĐÈ VÀ KHÓA
    
    -- Cập nhật chuỗi hàng ghế
    redis.call('SET', rowKey, newRowStr)

    -- Đặt Lock cho từng ghế (Bắt đầu từ KEYS[3])
    for i = 3, #KEYS do
        redis.call('SET', KEYS[i], userId, 'EX', lockTTL)
    end

    -- Cập nhật số lượng vé user đang giữ
    redis.call('INCRBY', userCountKey, numSeats)
    -- Đặt TTL cho key đếm này bằng với lockTTL để nó tự reset nếu không thanh toán
    redis.call('EXPIRE', userCountKey, lockTTL)

    return "OK"
`;

const holdStandingSeatsLuaScript = `
    local rowKey = KEYS[1]
    local userCountKey = KEYS[2]
    local lockTTL = tonumber(ARGV[1])
    local userId = ARGV[2]
    local numSeats = #KEYS - 2
    local currentHeldCount = tonumber(redis.call('GET', userCountKey) or 0)

    if currentHeldCount + numSeats > 4 then
        return redis.error_reply("EXCEED_MAX_TICKETS_LIMIT")
    end

    local rowStr = redis.call('GET', rowKey)
    if not rowStr then
        return redis.error_reply("ROW_NOT_FOUND")
    end

    local chars = {}
    for i = 1, #rowStr do
        chars[i] = rowStr:sub(i, i)
    end

    for i = 1, numSeats do
        local seatColIndex = tonumber(ARGV[2 + i])
        if chars[seatColIndex] ~= 'O' then
            return redis.error_reply("SEAT_UNAVAILABLE")
        end
        chars[seatColIndex] = 'H'
    end

    redis.call('SET', rowKey, table.concat(chars))

    for i = 3, #KEYS do
        redis.call('SET', KEYS[i], userId, 'EX', lockTTL)
    end

    redis.call('INCRBY', userCountKey, numSeats)
    redis.call('EXPIRE', userCountKey, lockTTL)

    return "OK"
`;

const rollbackLuaScript = `
    local userCountKey = KEYS[1]
    local userId = ARGV[1]
    local numSeats = tonumber(ARGV[2]) or 0

    -- KEYS layout:
    -- KEYS[1] = user held_count key
    -- KEYS[2..numSeats+1] = seat lock keys
    -- KEYS[numSeats+2..end] = row keys cần restore

    -- 1. Giải phóng lock ghế, chỉ xóa nếu lock đúng là của user này.
    for i = 1, numSeats do
        local lockKey = KEYS[i + 1]
        if lockKey and redis.call("GET", lockKey) == userId then
            redis.call("DEL", lockKey)
        end
    end

    -- 2. Khôi phục lại row string cũ.
    local numRows = #KEYS - (numSeats + 1)
    for i = 1, numRows do
        local rowKey = KEYS[numSeats + 1 + i]
        local prevString = ARGV[2 + i]
        if rowKey and prevString then
            redis.call("SET", rowKey, prevString)
        end
    end

    -- 3. Trừ held_count an toàn. Nếu key đang chứa dữ liệu rác/non-number thì xem như 0.
    local rawCount = redis.call("GET", userCountKey)
    local currentCount = tonumber(rawCount) or 0

    if currentCount > 0 and numSeats > 0 then
        if currentCount >= numSeats then
            local nextCount = currentCount - numSeats
            if nextCount > 0 then
                redis.call("SET", userCountKey, nextCount)
                redis.call("EXPIRE", userCountKey, tonumber(ARGV[3]) or 600)
            else
                redis.call("DEL", userCountKey)
            end
        else
            redis.call("DEL", userCountKey)
        end
    end

    return "OK"
`;
const releaseSeatsLuaScript = `
    local rowKey = KEYS[1]
    local userCountKey = KEYS[2]
    local rowStr = redis.call('GET', rowKey)
    if not rowStr then return nil end

    local chars = {}
    for i = 1, #rowStr do
        chars[i] = rowStr:sub(i, i)
    end

    local numSeatsToRelease = #ARGV
    for i = 1, numSeatsToRelease do
        local colIndex = tonumber(ARGV[i])
        chars[colIndex] = 'O'
    end

    local newRowStr = table.concat(chars)
    redis.call('SET', rowKey, newRowStr)

    for i = 3, #KEYS do
        redis.call('DEL', KEYS[i])
    end

    if numSeatsToRelease > 0 then
        local currentCount = tonumber(redis.call('GET', userCountKey) or 0)
        if currentCount >= numSeatsToRelease then
            redis.call('DECRBY', userCountKey, numSeatsToRelease)
        else
            redis.call('SET', userCountKey, 0)
        end
    end

    return newRowStr
`;


interface ModifiedRow {
    rowLabel: string;
    prevString: string;
}

export const rollbackLocksAndRows = async (
    event_id: string,
    show_id: string,
    zone_id: string,
    user_id: string,
    locked_seat_ids: string[],
    modifiedRows: ModifiedRow[]
): Promise<void> => {


    if (locked_seat_ids.length === 0 && modifiedRows.length === 0) {
        return;
    }

    const keys: string[] = [
        `event:${event_id}:show:${show_id}:user:${user_id}:held_count`
    ];


    const args: string[] = [
        user_id,
        locked_seat_ids.length.toString(),
        HOLD_DURATION_SECONDS.toString()
    ];


    for (const seat_id of locked_seat_ids) {
        keys.push(`event:${event_id}:show:${show_id}:seat:${seat_id}:lock`);
    }


    for (const row of modifiedRows) {
        keys.push(`event:${event_id}:show:${show_id}:zone:${zone_id}:row:${row.rowLabel}`);
        args.push(row.prevString);
    }

    try {

        await redisClient.eval(rollbackLuaScript, {
            keys: keys,
            arguments: args
        });


        for (const seat_id of locked_seat_ids) {
            await redisClient.publish('SEAT_UPDATES', JSON.stringify({
                show_id: show_id,
                seat_id: seat_id,
                status: 'available'
            }));
        }

        console.log(`[Rollback Success] Đã nhả ${locked_seat_ids.length} ghế và khôi phục ${modifiedRows.length} hàng.`);
    } catch (error) {

        console.error("[Rollback Error] Lỗi nghiêm trọng khi dọn dẹp Redis:", error);
    }
};

export const holdSeats = async (req: Request, res: Response): Promise<void> => {
    const user_id = req.user!.id;
    const { items } = req.body;
    const { event_id, show_id } = req.checkoutData;
    const currentUser = await User.findById(user_id);
    if (!currentUser) throw new Error('Không tìm thấy thông tin người dùng hợp lệ.');

    if (!event_id || !show_id || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ message: 'Dữ liệu đầu vào không hợp lệ.' });
        return;
    }

    const seat_ids = items.map(item => item.seat_id);
    const ticket_type_ids = items.map(item => item.ticket_type_id);
    const successfullyLockedSeats: string[] = [];
    const modifiedRowsForRollback: { rowLabel: string, prevString: string }[] = [];
    let zone_id = '';
    let createdOrderId: string | null = null;

    try {
        const targetSeats = await Seat.find({ _id: { $in: seat_ids } });
        if (targetSeats.length !== seat_ids.length) {
            res.status(400).json({ message: 'Một số ghế không tồn tại.' });
            return;
        }

        zone_id = targetSeats[0].zone_id.toString();
        const hasMixedZone = targetSeats.some(seat => seat.zone_id.toString() !== zone_id);
        if (hasMixedZone) {
            res.status(400).json({ message: 'Mỗi lần giữ chỗ chỉ được chọn vé trong cùng một khu vực.' });
            return;
        }

        const selectedZone = await Zone.findById(zone_id).lean();
        if (!selectedZone) {
            res.status(404).json({ message: 'Không tìm thấy khu vực của vé.' });
            return;
        }

        const seatsByRow: { [key: string]: typeof targetSeats } = {};
        const lockedByTier: Record<string, number> = {};
        items.forEach(item => { lockedByTier[item.ticket_type_id] = (lockedByTier[item.ticket_type_id] || 0) + 1; });
        console.log("Số lượng vé theo từng loại đang giữ trong request này:", lockedByTier);
        targetSeats.forEach(seat => {

            if (!seatsByRow[seat.row]) seatsByRow[seat.row] = [];
            seatsByRow[seat.row].push(seat);
        });

        for (const rowLabel in seatsByRow) {
            const seatsInRow = seatsByRow[rowLabel];
            const rowKey = `event:${event_id}:show:${show_id}:zone:${zone_id}:row:${rowLabel}`;

            const prevRowString = await redisClient.get(rowKey);
            const keys = [rowKey, `event:${event_id}:show:${show_id}:user:${user_id}:held_count`];
            const args = [String(HOLD_DURATION_SECONDS), user_id!];

            seatsInRow.forEach(seat => {
                keys.push(`event:${event_id}:show:${show_id}:seat:${seat._id}:lock`);
                args.push(String(seat.col_index));
            });

            try {
                await redisClient.eval(selectedZone.is_standing ? holdStandingSeatsLuaScript : holdSeatsLuaScript, { keys, arguments: args });

                seatsInRow.forEach(s => successfullyLockedSeats.push(s._id.toString()));
                if (typeof prevRowString === 'string') {
                    modifiedRowsForRollback.push({ rowLabel, prevString: prevRowString });
                }
            } catch (error: any) {
                const errMsg = error.message;
                await rollbackLocksAndRows(event_id, show_id, zone_id, user_id, successfullyLockedSeats, modifiedRowsForRollback);

                if (errMsg.includes("SEAT_UNAVAILABLE")) {
                    res.status(409).json({ message: `Ghế ở hàng ${rowLabel} đã bị người khác giữ!` }); return;
                }
                if (errMsg.includes("ORPHAN_SEAT_VIOLATION")) {
                    res.status(400).json({ message: `Lỗi để trống ghế lẻ tại hàng ${rowLabel}. Vui lòng chọn lại!` }); return;
                }
                if (errMsg.includes("ROW_NOT_FOUND")) {
                    res.status(500).json({ message: 'Dữ liệu sơ đồ ghế chưa được khởi tạo.' }); return;
                }
                if (errMsg.includes("EXCEED_MAX_TICKETS_LIMIT")) {
                    res.status(400).json({ message: 'Bạn chỉ có thể giữ tối đa 4 vé cho một suất chiếu.' }); return;
                }
                console.error("Lỗi giữ ghế:", error);
                res.status(500).json({ message: 'Lỗi hệ thống khi giữ ghế.' }); return;
            }
        }


        const statusHashKey = `show:${show_id}:seat_status`;

        for (const seat_id of successfullyLockedSeats) {
            const stringShowId = show_id.toString();


            await redisClient.hSet(statusHashKey, seat_id.toString(), 'holding');

            console.log(`📢 [Trạm 1] Đang publish cho ghế ${seat_id} của Show ${stringShowId}`);
            await redisClient.publish('SEAT_UPDATES', JSON.stringify({
                show_id: stringShowId,
                seat_id: seat_id.toString(),
                status: 'holding'
            }));
        }
        const uniqueSeatIds = [...new Set(seat_ids.map(String))];
        const uniqueTicketTypeIds = [...new Set(ticket_type_ids.map(String))];


        const seatsFromDb = await Seat.find({ _id: { $in: uniqueSeatIds } });
        const ticketTypesFromDb = await TicketType.find({ _id: { $in: uniqueTicketTypeIds } }) as any[];

        if (seatsFromDb.length !== uniqueSeatIds.length || ticketTypesFromDb.length !== uniqueTicketTypeIds.length) {
            throw new Error('Có ghế hoặc loại vé không tồn tại trong hệ thống.');
        }

        let totalPrice = 0;
        const orderTicketsData = [];

        for (const item of items) {
            const seat = seatsFromDb.find(s => s._id.toString() === item.seat_id);
            const selectedTicketType = ticketTypesFromDb.find(t => t._id.toString() === item.ticket_type_id);
            if (!selectedTicketType) throw new Error('Loại vé bạn chọn không tồn tại.');
            const seatTier = String(seat!.tier || '').toUpperCase();
            const ticketTier = String(selectedTicketType.target_tier || '').toUpperCase();
            if (!selectedZone.is_standing && seatTier !== ticketTier) {
                throw new Error(`Ghế hạng ${seat!.tier} không khớp với vé.`);
            }
            if (selectedZone.is_standing && seat!.ticket_type_id?.toString() !== selectedTicketType._id.toString()) {
                throw new Error('Vé GA không khớp với khu vực standing đã chọn.');
            }

            totalPrice += selectedTicketType.price;
            orderTicketsData.push({
                seat_id: seat!._id,
                ticket_type_id: selectedTicketType._id,
                price: selectedTicketType.price
            });
        }

        const cancellation_deadline = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000);
        const newOrder = await Order.create({
            order_number: `TKF-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
            user_id: user_id,
            event_id: event_id,
            show_id: show_id,
            zone_id: zone_id,
            items: orderTicketsData,
            total_price: totalPrice,
            status: 'pending',
            cancellation_deadline: cancellation_deadline,
            purchaser_name: `${currentUser.first_name} ${currentUser.last_name}`,
            purchaser_email: currentUser.email,
            purchaser_phone: currentUser.phone
        });
        createdOrderId = newOrder._id.toString();

        await updateZoneSummaryAfterHold({
            eventId: event_id,
            showId: show_id,
            zoneId: zone_id,
            modifiedRows: modifiedRowsForRollback,
            lockedByTicketType: lockedByTier,
            seatIds: seat_ids
        });

        await orderExpirationQueue.add(
            `expire-${newOrder._id}`,
            { order_id: newOrder._id, event_id, show_id, zone_id, seat_ids },
            { delay: HOLD_DURATION_SECONDS * 1000 }
        );

        res.status(201).json({
            message: 'Giữ chỗ thành công!',
            data: {
                order_id: newOrder._id, total_price: newOrder.total_price, lockedSeats: seat_ids,
                cancellation_deadline: newOrder.cancellation_deadline,
                server_now: new Date()
            }
        });


    } catch (error: any) {
        if (successfullyLockedSeats.length > 0 && zone_id) {
            await rollbackLocksAndRows(event_id, show_id, zone_id, user_id, successfullyLockedSeats, modifiedRowsForRollback);
            await redisClient.hDel(`show:${show_id}:seat_status`, successfullyLockedSeats);
        }
        if (createdOrderId) {
            await Order.findByIdAndUpdate(createdOrderId, { status: 'cancelled' });
        }
        res.status(400).json({ message: error.message || 'Lỗi hệ thống nội bộ.' });
    }
};
export const releaseSeats = async (req: Request, res: Response): Promise<void> => {
    const user_id = req.user!.id;
    const { order_id } = req.body;

    if (!order_id) {
        res.status(400).json({ message: 'Vui lòng cung cấp mã đơn hàng.' });
        return;
    }

    try {

        const order = await Order.findOne({ _id: order_id, user_id: user_id });
        if (!order) {
            res.status(404).json({ message: 'Không tìm thấy đơn hàng của bạn.' });
            return;
        }

        if (order.status !== 'pending') {
            res.status(400).json({ message: 'Đơn hàng này không ở trạng thái chờ xử lý.' });
            return;
        }


        const seatIds = order.items.map(item => item.seat_id.toString());
        const { event_id, show_id, zone_id } = order;
        const strEventId = event_id.toString();
        const strShowId = show_id.toString();
        const strZoneId = zone_id.toString();


        order.status = 'cancelled';
        await order.save();


        const seatsToRelease = await Seat.find({ _id: { $in: seatIds } });
        const seatsByRow: Record<string, typeof seatsToRelease> = {};
        const releaseByTier: Record<string, number> = {};

        seatsToRelease.forEach(seat => {
            if (!seatsByRow[seat.row]) seatsByRow[seat.row] = [];
            seatsByRow[seat.row].push(seat);
            const ticketTypeId = seat.ticket_type_id?.toString();
            if (ticketTypeId) {
                releaseByTier[ticketTypeId] = (releaseByTier[ticketTypeId] || 0) + 1;
            }
        });

        const updatedRowStrings: string[] = [];

        for (const rowLabel in seatsByRow) {
            const seatsInRow = seatsByRow[rowLabel];
            const rowKey = `event:${event_id}:show:${show_id}:zone:${zone_id}:row:${rowLabel}`;
            const keys = [rowKey, `event:${event_id}:show:${show_id}:user:${user_id}:held_count`];
            const args: string[] = [];

            seatsInRow.forEach(seat => {
                keys.push(`event:${event_id}:show:${show_id}:seat:${seat._id}:lock`);
                args.push(String(seat.col_index));
            });

            const newString = await redisClient.eval(releaseSeatsLuaScript, {
                keys: keys,
                arguments: args
            }) as string;

            if (newString) updatedRowStrings.push(newString);
        }


        const statusHashKey = `show:${show_id}:seat_status`;
        await redisClient.hDel(statusHashKey, seatIds);

        await updateZoneSummaryAfterRelease({
            eventId: strEventId,
            showId: strShowId,
            zoneId: strZoneId,
            updatedRowStrings,
            releasedByTicketType: releaseByTier,
            seatIds
        });


        for (const seatId of seatIds) {
            await redisClient.publish('SEAT_UPDATES', JSON.stringify({
                show_id: strShowId,
                seat_id: seatId,
                status: 'available'
            }));
        }

        res.status(200).json({
            message: 'Đã hủy giữ chỗ thành công.',
            data: { order_id: order_id }
        });

    } catch (error) {
        console.error('[OrderController] Lỗi releaseSeats:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ khi nhả ghế.' });
    }
};

export const getOrders = async (req: Request, res: Response) => {
    try {
        const user_id = req.user!.id;
        const attendee = await User.findById(user_id).select('-password');
        if (!attendee) {
            return res.status(404).json({ message: 'Attendee not found' });
        }
        if (attendee.id !== user_id) {
            return res.status(403).json({ message: 'Unauthorized to view orders' });
        }
        const orders = await Order.find({ user_id: user_id }).populate('event_id', 'name').sort({ created_at: -1 }).populate({
            path: 'show_id',
            select: 'name venue_id start_time',
            populate: {
                path: 'venue_id',
                model: 'Venue',
                select: 'name'
            }
        });
        const ticketNumbers = orders.flatMap(order => order.items.map(item => item.seat_id));
        res.status(200).json({ orders, ticketNumbers });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching attendee orders', error });
    }
};



export const getOrderById = async (req: Request, res: Response) => {
    try {
        const user_id = req.user!.id;
        const order_id = req.params.order_id;
        const attendee = await User.findById(user_id).select('-password');
        if (!attendee) {
            return res.status(404).json({ message: 'Attendee not found' });
        }
        const order = await Order.findById(order_id)
            .populate('event_id', 'name')
            .populate({
                path: 'show_id',
                select: 'name start_time status venue_id',
                populate: {
                    path: 'venue_id',
                    model: 'Venue',
                    select: 'name'
                }
            })
            .lean();
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.user_id.toString() !== user_id) {
            return res.status(403).json({ message: 'Unauthorized to view this order' });
        }
        const tickets = await Ticket.find({ user_id, order_id: order._id })
            .populate('ticket_type_id')
            .populate('seat_id')
            .populate('zone_id')
            .populate('event_id').lean();;
        res.status(200).json({ order, tickets });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching order details', error });
    }
};
