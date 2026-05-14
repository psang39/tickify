import { Request, Response } from 'express';
import redisClient from '../utils/redisClient'; // Đảm bảo bạn đã export redisClient
import Order from '../models/order.model'; // Đảm bảo bạn đã tạo model Order với các trường cần thiết
import Seat from '../models/seat.model';
import Zone from '../models/zone.model';
import TicketType from '../models/ticket-type.model';
import Show from '../models/show.model';
import Ticket from '../models/ticket.model';
import { orderExpirationQueue } from '../queues/orderExpiration.queue';
import { validateOrphanSeats } from '../utils/seatValidation';
import { calculateValidQuantities } from '../utils/validQuantities';
import { formatHashToJSON } from '../utils/hashToJson';
// Thời gian giữ ghế: 10 phút = 600 giây
const HOLD_DURATION_SECONDS = 600;

const holdSeatsLuaScript = `
    local rowKey = KEYS[1]
    local userCountKey = KEYS[2] -- Key mới để đếm số vé user đang giữ
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
// 0. Khai báo script Lua ở ngoài để tái sử dụng
const rollbackLuaScript = `
    local userCountKey = KEYS[1]
    local userId = ARGV[1]
    local numSeats = tonumber(ARGV[2])

    -- 1. GIẢI PHÓNG GHẾ ĐÃ KHÓA
    -- Lặp qua các key ghế. Vẫn giữ logic cực tốt của bạn: Chỉ xóa nếu đúng là của user này.
    for i = 1, numSeats do
        local lockKey = KEYS[i]
        if redis.call("GET", lockKey) == userId then
            redis.call("DEL", lockKey)
        end
    end
    

    -- 2. KHÔI PHỤC LẠI CHUỖI CÁC HÀNG (ROW)
    -- Lấy tổng số KEYS trừ đi số ghế sẽ ra số lượng hàng cần khôi phục
    local numRows = #KEYS - numSeats
    for i = 1, numRows do
        local rowKey = KEYS[numSeats + i]
        local prevString = ARGV[2 + i]
        
        -- Ghi đè lại trạng thái cũ
        redis.call("SET", rowKey, prevString)
    end
    if redis.call("GET", userCountKey>0) then
        redis.call("DECRBY", userCountKey, numSeats)
    end
    
    return "OK"
`;


// Hàm helper để rollback an toàn
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

    // Nếu không có gì để rollback thì thoát luôn cho nhẹ máy
    if (locked_seat_ids.length === 0 && modifiedRows.length === 0) {
        return;
    }

    const keys: string[] = [];

    // ARGS cơ bản: Truyền vào userId và "số lượng ghế" để Lua biết đường cắt mảng KEYS
    const args: string[] = [user_id, locked_seat_ids.length.toString()];

    // 1. Nhét Key của ghế vào mảng KEYS
    for (const seat_id of locked_seat_ids) {
        keys.push(`event:${event_id}:show:${show_id}:seat:${seat_id}:lock`);
    }

    // 2. Nhét Key của hàng vào KEYS, và dữ liệu prevString vào ARGS
    for (const row of modifiedRows) {
        keys.push(`event:${event_id}:show:${show_id}:zone:${zone_id}:row:${row.rowLabel}`);
        args.push(row.prevString); // prevString sẽ nằm từ ARGV[3] trở đi
    }

    try {
        // Thực thi kịch bản dọn dẹp
        await redisClient.eval(rollbackLuaScript, {
            keys: keys,
            arguments: args
        });

        // Bắn sự kiện (SSE) để Frontend biết mà bỏ tô màu xám của những ghế này đi
        for (const seat_id of locked_seat_ids) {
            await redisClient.publish('SEAT_UPDATES', JSON.stringify({
                show_id: show_id,
                seat_id: seat_id,
                status: 'available' // Trả lại màu xanh
            }));
        }

        console.log(`[Rollback Success] Đã nhả ${locked_seat_ids.length} ghế và khôi phục ${modifiedRows.length} hàng.`);
    } catch (error) {
        // Lỗi ở bước này hiếm khi xảy ra trừ khi sập Redis
        console.error("[Rollback Error] Lỗi nghiêm trọng khi dọn dẹp Redis:", error);
    }
};

export const holdSeats = async (req: Request, res: Response): Promise<void> => {
    const user_id = req.user?.id || 'user_demo_123';
    const { items } = req.body;
    const { event_id, show_id } = req.checkoutData;

    if (!event_id || !show_id || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ message: 'Dữ liệu đầu vào không hợp lệ.' });
        return;
    }

    const seat_ids = items.map(item => item.seat_id);
    const successfullyLockedSeats: string[] = [];
    const modifiedRowsForRollback: { rowLabel: string, prevString: string }[] = [];
    let zone_id = ''; // Khai báo ở đây để dùng cho catch block

    try {
        // 1. CHỈ QUERY ĐÚNG NHỮNG GHẾ ĐƯỢC CHỌN
        const targetSeats = await Seat.find({ _id: { $in: seat_ids } });
        if (targetSeats.length !== seat_ids.length) {
            res.status(400).json({ message: 'Một số ghế không tồn tại.' });
            return;
        }

        // Fix bug nhỏ: Lấy zone_id từ targetSeats thay vì seat_ids
        zone_id = targetSeats[0].zone_id.toString();

        // 2. GOM NHÓM GHẾ THEO TỪNG HÀNG (ROW)
        const seatsByRow: { [key: string]: typeof targetSeats } = {};
        const lockedByTier: Record<string, number> = {};
        targetSeats.forEach(seat => {
            lockedByTier[seat.tier] = (lockedByTier[seat.tier] || 0) + 1;
            if (!seatsByRow[seat.row]) seatsByRow[seat.row] = [];
            seatsByRow[seat.row].push(seat);
        });

        // 3. THỰC THI LUA SCRIPT CHO TỪNG HÀNG
        for (const rowLabel in seatsByRow) {
            const seatsInRow = seatsByRow[rowLabel];
            const rowKey = `event:${event_id}:show:${show_id}:zone:${zone_id}:row:${rowLabel}`;

            const prevRowString = await redisClient.get(rowKey);
            const keys = [rowKey, `event:${event_id}:show:${show_id}:user:${user_id}:held_count`];
            const args = [String(HOLD_DURATION_SECONDS), user_id];

            seatsInRow.forEach(seat => {
                keys.push(`event:${event_id}:show:${show_id}:seat:${seat._id}:lock`);
                args.push(String(seat.col_index));
            });

            try {
                await redisClient.eval(holdSeatsLuaScript, { keys, arguments: args });

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
                    res.status(500).json({ message: 'Dữ liệu sơ đồ ghế chưa được khởi tạo trên hệ thống.' }); return;
                }

                res.status(500).json({ message: 'Lỗi hệ thống khi giữ ghế.' }); return;
            }
        }

        // 4. QUA CỬA THÀNH CÔNG -> BẮN SSE MÀU GHẾ
        for (const seat_id of successfullyLockedSeats) {
            await redisClient.publish('SEAT_UPDATES', JSON.stringify({
                show_id: show_id,
                seat_id: seat_id,
                status: 'holding'
            }));
        }



        // ==========================================
        // 6. LOGIC DATABASE: VALIDATE ZONE & TIER (GIỮ NGUYÊN 100%)
        // ==========================================
        const seatsFromDb = await Seat.find({ _id: { $in: seat_ids } });
        if (seatsFromDb.length !== seat_ids.length) {
            throw new Error('Có ghế không tồn tại trong hệ thống.');
        }

        const uniqueZones = new Set(seatsFromDb.map(s => s.zone_id.toString()));
        if (uniqueZones.size > 1) {
            throw new Error('Chỉ được phép mua vé trong cùng 1 khu vực (Zone) cho mỗi đơn hàng.');
        }

        const zone = await Zone.findById(zone_id).populate('ticket_type_ids');
        if (!zone) throw new Error('Không tìm thấy khu vực này.');

        let totalPrice = 0;
        const orderTicketsData = [];

        for (const item of items) {
            const seat = seatsFromDb.find(s => s._id.toString() === item.seat_id);
            const selectedTicketType = (zone.ticket_type_ids as any[]).find(
                tt => tt._id.toString() === item.ticket_type_id
            );

            if (!selectedTicketType) throw new Error('Loại vé bạn chọn không tồn tại trong khu vực này.');
            if (seat!.tier !== selectedTicketType.target_tier) {
                throw new Error(`Ghế hạng ${seat!.tier} không thể mua bằng loại vé ${selectedTicketType.name}.`);
            }

            totalPrice += selectedTicketType.price;
            orderTicketsData.push({
                seat_id: seat!._id,
                ticket_type_id: selectedTicketType._id,
                price_paid: selectedTicketType.price
            });
        }

        // ==========================================
        // 7. TẠO ĐƠN HÀNG & THÊM VÀO QUEUE (GIỮ NGUYÊN 100%)
        // ==========================================
        // (Đã xóa dòng decrBy cũ ở đây)

        const cancellation_deadline = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000);

        const newOrder = await Order.create({
            user_id: user_id,
            event_id: event_id,
            show_id: show_id,
            zone_id: zone_id,
            items: orderTicketsData,
            total_price: totalPrice,
            status: 'pending',
            cancellation_deadline: cancellation_deadline
        });

        await orderExpirationQueue.add(
            `expire-${newOrder._id}`,
            {
                order_id: newOrder._id,
                event_id: event_id,
                show_id: show_id,
                zone_id: zone_id,
                seat_ids: seat_ids
            },
            { delay: HOLD_DURATION_SECONDS * 1000 }
        );

        res.status(201).json({
            message: 'Giữ chỗ thành công! Bạn có thời gian để hoàn tất thanh toán.',
            data: {
                order_id: newOrder._id,
                total_price: newOrder.total_price,
                cancellation_deadline: newOrder.cancellation_deadline,
                lockedSeats: seat_ids
            }
        });

        // 5. CẬP NHẬT SUMMARY NGẦM BẰNG REDIS HASH (Mới & Tối ưu nhất)
        setTimeout(async () => {
            try {
                const holdingSetKey = `event:${event_id}:show:${show_id}:holding_seats`;
                const summaryKey = `event:${event_id}:show:${show_id}:zone:${zone_id}:summary`;
                const updatedRowStrings = await redisClient.mGet(modifiedRowsForRollback.map(r => `event:${event_id}:show:${show_id}:zone:${zone_id}:row:${r.rowLabel}`)) as string[];

                const pipeline = redisClient.multi();

                // Trừ số lượng trực tiếp (Atomic)
                for (const [tierName, lockedCount] of Object.entries(lockedByTier)) {
                    pipeline.hIncrBy(summaryKey, `tier:${tierName}:count`, -lockedCount);
                }

                // Cập nhật lại valid_quantities
                const updatedValidQuantities = calculateValidQuantities(updatedRowStrings);
                pipeline.hSet(summaryKey, 'valid_quantities', JSON.stringify(updatedValidQuantities));
                pipeline.sAdd(holdingSetKey, seat_ids);
                await pipeline.exec();

                // Lấy lại Hash mới nhất, format và bắn SSE
                const updatedHash = await redisClient.hGetAll(summaryKey);
                const summaryJSON = formatHashToJSON(updatedHash);

                await redisClient.publish('ZONE_SUMMARY_UPDATES', JSON.stringify({
                    zone_id: zone_id,
                    summary: summaryJSON
                }));
                const seatUpdates = seat_ids.map(id => ({ seat_id: id, status: 'holding' }));
                redisClient.publish(`SHOW_${show_id}_SEATS_CHANNEL`, JSON.stringify(seatUpdates));

            } catch (err) {
                console.error("Lỗi cập nhật Zone Summary:", err);
            }
        }, 0);


    } catch (error: any) {
        console.error('[OrderController] Lỗi holdSeats:', error.message);

        if (successfullyLockedSeats.length > 0 && zone_id) {
            await rollbackLocksAndRows(event_id, show_id, zone_id, user_id, successfullyLockedSeats, modifiedRowsForRollback);
            // Có thể xem xét Rollback HINCRBY của Summary ở đây nếu cần thiết và logic cho phép
        }

        res.status(400).json({ message: error.message || 'Lỗi hệ thống nội bộ. Đã hoàn tác.' });
    }
};

export const releaseSeats = async (req: Request, res: Response): Promise<void> => {
    const user_id = req.user?.id || 'user_demo_123';
    const { order_id, event_id, seatIds } = req.body;

    if (!order_id || !event_id || !Array.isArray(seatIds) || seatIds.length === 0) {
        res.status(400).json({ message: 'Dữ liệu đầu vào không hợp lệ. Cần order_id, event_id và mảng seatIds.' });
        return;
    }

    try {
        // 1. KIỂM TRA ĐƠN HÀNG HỢP LỆ
        const order = await Order.findOne({ _id: order_id, user_id: user_id });
        if (!order) {
            res.status(404).json({ message: 'Không tìm thấy đơn hàng của bạn.' });
            return;
        }

        if (order.status !== 'pending') {
            res.status(400).json({ message: 'Chỉ có thể hủy những đơn hàng đang chờ thanh toán.' });
            return;
        }

        // 2. DỌN DẸP TRÊN REDIS (Xóa khóa an toàn bằng Lua Script)
        // Vẫn dùng Lua Script để đảm bảo chỉ xóa đúng cái khóa do chính User này tạo ra
        const releaseLockScript = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;

        for (const seatId of seatIds) {
            const lockKey = `event:${event_id}:seat:${seatId}:lock`;
            await redisClient.eval(
                releaseLockScript,
                {
                    keys: [lockKey],
                    arguments: [user_id]
                }
            );
        }

        // 3. DỌN DẸP TRÊN MONGODB

        // 3.1. Cập nhật trạng thái ghế về lại AVAILABLE (Màu xanh)
        await Seat.updateMany(
            { _id: { $in: seatIds } },
            { $set: { status: 'AVAILABLE' } }
        );

        // 3.2. Cập nhật trạng thái đơn hàng thành CANCELLED
        await Order.findByIdAndUpdate(order_id, {
            $set: { status: 'CANCELLED' }
        });

        // 4. TrẢ VỀ KẾT QUẢ
        res.status(200).json({
            message: 'Đã hủy giữ chỗ thành công. Các ghế đã được nhả ra cho người khác.',
            data: {
                order_id: order_id,
                releasedSeats: seatIds
            }
        });

    } catch (error) {
        console.error('[OrderController] Lỗi releaseSeats:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ trong quá trình nhả ghế.' });
    }
};

export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
    const user_id = req.user?.id;
    try {
        const orders = await Order.find({ user_id: user_id }).populate('seat_ids').populate('event_id').populate('ticket_type_id');
        res.status(200).json({ message: 'Lấy đơn hàng thành công', data: orders });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy đơn hàng', error });
    }
};

// export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
//     const user_id = req.user?.id;
//     const { order_id } = req.params;
//     try {
//         const order = await Order.findById(order_id);
//         if (!order || order.user_id.toString() !== user_id) {
//             res.status(404).json({ message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền hủy đơn hàng này.' });
//             return;
//         }
//         if (order.status !== 'PENDING') {
//             res.status(400).json({ message: 'Chỉ có thể hủy đơn hàng đang ở trạng thái PENDING.' });
//             return;
//         }
//         order.status = 'CANCELED';
//         await order.save();
//         await Seat.updateMany(
//             { _id: { $in: order.seat_ids } },
//             { $set: { status: 'AVAILABLE' } }
//         );
//         for (const seatId of order.seat_ids) {
//             await redisClient.del(`event:${order.event_id}:seat:${seatId}:lock`);
//         }
//         res.status(200).json({ message: 'Hủy đơn hàng thành công' });
//     } catch (error) {
//         res.status(500).json({ message: 'Lỗi máy chủ khi hủy đơn hàng', error });
//     }
// };

export const getOrderDetail = async (req: Request, res: Response): Promise<void> => {
    const user_id = req.user?.id;
    const { order_id } = req.params;
    try {
        const order = await Order.findById(order_id).populate('seat_ids').populate('event_id').populate('ticket_type_id');
        if (!order || order.user_id.toString() !== user_id) {
            res.status(404).json({ message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền xem đơn hàng này.' });
            return;
        }
        res.status(200).json({ message: 'Lấy chi tiết đơn hàng thành công', data: order });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy chi tiết đơn hàng', error });
    }
};
