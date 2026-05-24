import Ticket from '../models/ticket.model';
import User from '../models/user.model';
import Show from '../models/show.model';
import Zone from '../models/zone.model';
import TicketType from '../models/ticket-type.model';
import Seat from '../models/seat.model';
import Order from '../models/order.model';
import { Request, Response } from 'express';
import redisClient from '../utils/redisClient';
import crypto from 'crypto';
import { RSA_PRIVATE_KEY } from '../config/index';
import { Secret, TOTP } from '@otp-lib/authenticator';
import { verifyTicketToken } from '../config/totp.util';
import { decryptPrivateKey } from '../utils/cryptoUtils';
const SERVER_PRIVATE_KEY = RSA_PRIVATE_KEY;
if (!SERVER_PRIVATE_KEY) {
    throw new Error('RSA_PRIVATE_KEY is not configured');
}
export const getMyTickets = async (req: Request, res: Response) => {
    try {
        const user_id = req.user?.id;
        const order_id = req.params.order_id;
        const order = await Order.findById(order_id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.user_id.toString() !== user_id) {
            return res.status(403).json({ message: 'Unauthorized to view tickets of this order' });
        }
        const user = await User.findById(user_id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.id !== user_id) {
            return res.status(403).json({ message: 'Unauthorized to view tickets' });
        }

        const tickets = await Ticket.find({ user_id, order_id })
            .populate('ticket_type_id')
            .populate('seat_id')
            .populate('show_id')
            .populate('zone_id')
            .populate('event_id').lean();
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching tickets', error });
    }
};
export const getTicketDetail = async (req: Request, res: Response): Promise<void> => {
    const user_id = req.user?.id;
    const user = await User.findById(user_id).select('-password');
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    const ticket_id = req.params.ticket_id;
    try {
        // Gộp 2 lệnh populate show_id làm một để tránh mất dữ liệu
        const ticket = await Ticket.findById(ticket_id)
            .populate('ticket_type_id', 'name description price')
            .populate('seat_id', 'seat_number row col_index')
            .populate('zone_id', 'name')
            .populate('event_id', 'name poster_url banner_url')
            .populate({
                path: 'show_id',
                // Gom tất cả các trường cần lấy của Show vào đây
                select: 'name start_date end_date start_time venue_id',
                populate: {
                    path: 'venue_id',
                    model: 'Venue',
                    select: 'name'
                }
            })
            .lean();

        if (!ticket || ticket.user_id.toString() !== user_id) {
            res.status(404).json({ message: 'Không tìm thấy vé.' });
            return;
        }


        res.status(200).json({
            data: {
                ...ticket, // Trải toàn bộ dữ liệu sạch của Ticket ra
                signature: ticket.signature // Đính kèm thêm signature của server
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server khi lấy chi tiết vé' });
    }
};

// export const offlineScanProcess = async (qrData: string) => {
//     const parts = qrData.split('|');
//     if (parts.length < 4) {
//         return { success: false, message: "Mã QR không đúng chuẩn Dề Dê." };
//     }
//     const ticketId = parts[0];
//     const ticketSecret = parts[1];
//     const currentTotpCode = parts[2];
//     const signatureFromQR = parts[3];
//     const dataToVerify = `${ticketId}|${ticketSecret}`;
//     const verify = crypto.createVerify('SHA256');
//     verify.update(dataToVerify);
//     verify.end();
//     const isAuthentic = verify.verify(PUBLIC_KEY, signatureFromQR, 'base64');
//     if (!isAuthentic) {
//         return {
//             success: false,
//             message: "CẢNH BÁO: Vé giả mạo! Chữ ký không do Server phát hành."
//         };
//     }
//     const isFresh = await verifyTicketToken(currentTotpCode, ticketSecret);
//     if (!isFresh) {
//         return {
//             success: false,
//             message: "LỖI: Mã QR hết hạn. Vui lòng yêu cầu khách mở lại App!"
//         };
//     }
//     return {
//         success: true,
//         message: "Vé hợp lệ! Mời qua cổng.",
//         ticketId: ticketId
//     };
// };
export const syncCheckIn = async (req: Request, res: Response): Promise<void> => {
    const { ticketId, scannedAt } = req.body;
    try {
        const updatedTicket = await Ticket.findByIdAndUpdate(
            ticketId,
            {
                check_in_status: true,
                check_in_time: scannedAt || new Date()
            },
            { new: true }
        );
        if (!updatedTicket) {
            res.status(404).json({ message: 'Không tìm thấy ID vé trong DB.' });
            return;
        }
        res.status(200).json({ message: 'Đã đồng bộ trạng thái check-in lên Server' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi đồng bộ check-in' });
    }
};