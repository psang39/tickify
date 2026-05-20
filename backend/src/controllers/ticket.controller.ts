import Ticket from '../models/ticket.model';
import TicketType from '../models/ticket-type.model';
import Seat from '../models/seat.model';
import Order from '../models/order.model';
import { Request, Response } from 'express';
import redisClient from '../utils/redisClient';
import crypto from 'crypto';
import { RSA_PRIVATE_KEY } from '../config/index';
import { Secret, TOTP } from '@otp-lib/authenticator';
import { verifyTicketToken } from '../config/totp.util';
const SERVER_PRIVATE_KEY = RSA_PRIVATE_KEY;
if (!SERVER_PRIVATE_KEY) {
    throw new Error('RSA_PRIVATE_KEY is not configured');
}
export const getMyTickets = async (req: Request, res: Response) => {
    try {
        const user_id = req.user?.id;
        const tickets = await Ticket.find({ user_id }).populate('ticket_type_id').populate('seat_id');
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching tickets', error });
    }
};
export const getTicketDetail = async (req: Request, res: Response): Promise<void> => {
    const user_id = req.user?.id;
    const ticket_id = req.params.ticket_id;
    try {
        const ticket = await Ticket.findById(ticket_id);
        if (!ticket || ticket.user_id.toString() !== user_id) {
            res.status(404).json({ message: 'Không tìm thấy vé.' });
            return;
        }
        const payloadToSign = `${ticket._id}|${ticket.ticket_secret}`;
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(payloadToSign);
        const signature = signer.sign(SERVER_PRIVATE_KEY, 'base64');
        res.status(200).json({
            data: {
                ticket_id: ticket._id,
                show_id: ticket.show_id,
                zone_id: ticket.zone_id,
                seat_id: ticket.seat_id,
                ticket_secret: ticket.ticket_secret,
                signature: signature
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server khi lấy chi tiết vé' });
    }
};
export const onlineCheckIn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { qrData } = req.body;
        if (!qrData) {
            res.status(400).json({ message: "Thiếu dữ liệu QR Code!" });
            return;
        }
        const parts = qrData.split('|');
        if (parts.length < 3) {
            res.status(400).json({ message: "Định dạng mã QR không hợp lệ!" });
            return;
        }
        const ticketId = parts[0];
        const currentTotpCode = parts[2];
        const ticket = await Ticket.findById(ticketId).populate('seat_id ticket_type_id');
        if (!ticket) {
            res.status(404).json({ message: "Vé không tồn tại trên hệ thống!" });
            return;
        }
        if (ticket.status === 'USED') {
            res.status(400).json({
                message: "CẢNH BÁO: Vé này đã được sử dụng!",
                checkInTime: ticket.check_in_time
            });
            return;
        }
        if (ticket.status === 'INVALID') {
            res.status(400).json({ message: "Vé này đã bị hủy hoặc không hợp lệ!" });
            return;
        }
        const isValidTotp = await verifyTicketToken(currentTotpCode, ticket.ticket_secret);
        if (!isValidTotp) {
            res.status(401).json({
                message: "Mã QR đã hết hạn (chụp màn hình). Vui lòng yêu cầu khách mở lại App!"
            });
            return;
        }
        ticket.status = 'USED';
        ticket.check_in_time = new Date();
        await ticket.save();
        res.status(200).json({
            message: "Check-in thành công! Mời qua cổng.",
            ticketInfo: {
                ticket_id: ticket._id,
                seat: ticket.seat_id,
                type: ticket.ticket_type_id
            }
        });
    } catch (error) {
        console.error("Lỗi Check-in:", error);
        res.status(500).json({ message: "Lỗi hệ thống soát vé." });
    }
};
export const offlineScanProcess = async (qrData: string) => {
    const parts = qrData.split('|');
    if (parts.length < 4) {
        return { success: false, message: "Mã QR không đúng chuẩn Dề Dê." };
    }
    const ticketId = parts[0];
    const ticketSecret = parts[1];
    const currentTotpCode = parts[2];
    const signatureFromQR = parts[3];
    const dataToVerify = `${ticketId}|${ticketSecret}`;
    const verify = crypto.createVerify('SHA256');
    verify.update(dataToVerify);
    verify.end();
    const isAuthentic = verify.verify(PUBLIC_KEY, signatureFromQR, 'base64');
    if (!isAuthentic) {
        return {
            success: false,
            message: "CẢNH BÁO: Vé giả mạo! Chữ ký không do Server phát hành."
        };
    }
    const isFresh = await verifyTicketToken(currentTotpCode, ticketSecret);
    if (!isFresh) {
        return {
            success: false,
            message: "LỖI: Mã QR hết hạn. Vui lòng yêu cầu khách mở lại App!"
        };
    }
    return {
        success: true,
        message: "Vé hợp lệ! Mời qua cổng.",
        ticketId: ticketId
    };
};
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