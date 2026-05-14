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




// ----------------------------------------------------------------------
// 2. LẤY CHI TIẾT VÉ & KÝ TÊN BẰNG RSA (Gửi về App khán giả)
// ----------------------------------------------------------------------
export const getTicketDetail = async (req: Request, res: Response): Promise<void> => {
    const user_id = req.user?.id;
    const ticket_id = req.params.ticket_id;

    try {
        const ticket = await Ticket.findById(ticket_id);

        if (!ticket || ticket.user_id.toString() !== user_id) {
            res.status(404).json({ message: 'Không tìm thấy vé.' });
            return;
        }

        // BƯỚC ĐỘT PHÁ RSA: Backend dùng Private Key để ký lên dữ liệu của vé
        // Dữ liệu cần bảo vệ: Ghép TicketID và Secret lại
        const payloadToSign = `${ticket._id}|${ticket.ticket_secret}`;

        // Tạo chữ ký điện tử (Digital Signature)
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(payloadToSign);
        const signature = signer.sign(SERVER_PRIVATE_KEY, 'base64');

        // Trả về cho Frontend App. 
        // Frontend sẽ dùng cái `ticket_secret` để tạo mã TOTP xoay liên tục (ví dụ: 123456)
        // Sau đó Frontend sẽ tự gom 3 thứ này vẽ thành QR Code: "TicketID | 123456 | Signature"
        res.status(200).json({
            data: {
                ticket_id: ticket._id,
                show_id: ticket.show_id,
                zone_id: ticket.zone_id,
                seat_id: ticket.seat_id,
                ticket_secret: ticket.ticket_secret,
                signature: signature // Giao chữ ký cho Frontend giữ
            }
        });
    } catch (error) {
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

        // 1. Tách chuỗi QR để lấy thông tin
        // Cấu trúc: [0]TicketId | [1]Secret | [2]TOTP_Code | [3]Signature
        const parts = qrData.split('|');
        if (parts.length < 3) {
            res.status(400).json({ message: "Định dạng mã QR không hợp lệ!" });
            return;
        }

        const ticketId = parts[0];
        const currentTotpCode = parts[2];

        // 2. Tìm vé trong Database
        const ticket = await Ticket.findById(ticketId).populate('seat_id ticket_type_id');
        if (!ticket) {
            res.status(404).json({ message: "Vé không tồn tại trên hệ thống!" });
            return;
        }

        // 3. Kiểm tra trạng thái vé
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

        // 4. Kiểm tra mã TOTP (Chống chụp màn hình)
        // Lưu ý: Lấy ticket_secret từ Database để đối chiếu với mã 6 số từ QR
        const isValidTotp = await verifyTicketToken(currentTotpCode, ticket.ticket_secret);

        if (!isValidTotp) {
            res.status(401).json({
                message: "Mã QR đã hết hạn (chụp màn hình). Vui lòng yêu cầu khách mở lại App!"
            });
            return;
        }

        // 5. Cập nhật trạng thái thành CÔNG THÀNH (Đã check-in)
        ticket.status = 'USED';
        ticket.check_in_time = new Date();
        await ticket.save();

        res.status(200).json({
            message: "Check-in thành công! Mời qua cổng.",
            ticketInfo: {
                ticket_id: ticket._id,
                seat: ticket.seat_id, // Trả về thông tin ghế để bảo vệ hướng dẫn khách
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

    // BÀI TEST 1: CHỮ KÝ RSA CÓ PHẢI HÀNG THẬT KHÔNG?
    // Tái tạo lại chuỗi data gốc
    const dataToVerify = `${ticketId}|${ticketSecret}`;

    // Dùng Public Key để soi chữ ký
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

    // BÀI TEST 2: VÉ CÓ TƯƠI KHÔNG? (CHỐNG CHỤP MÀN HÌNH)
    // Vượt qua Test 1, máy quét tin tưởng 100% cái ticketSecret lấy từ QR là hàng thật.
    // Giờ nó lấy đồng hồ của máy quét ráp với ticketSecret đó để tính TOTP.
    const isFresh = await verifyTicketToken(currentTotpCode, ticketSecret);

    if (!isFresh) {
        return {
            success: false,
            message: "LỖI: Mã QR hết hạn. Vui lòng yêu cầu khách mở lại App!"
        };
    }

    // KẾT LUẬN: PASS CẢ 2 BÀI TEST (100% OFFLINE)
    // Lưu lại cái ticketId này vào bộ nhớ tạm (Local Storage/SQLite) của điện thoại bảo vệ.
    // Cuối ngày có mạng Wifi sẽ lấy danh sách đó đẩy lên Server (Hàm syncOfflineScans ban nãy).

    return {
        success: true,
        message: "✅ Vé hợp lệ! Mời qua cổng.",
        ticketId: ticketId
    };
};

export const syncCheckIn = async (req: Request, res: Response): Promise<void> => {
    // API này không cần nhận mã QR phức tạp nữa, vì Máy Quét (Scanner PWA) 
    // ĐÃ TỰ XÁC THỰC RSA VÀ TOTP OFFLINE ở ngay tại cổng bảo vệ rồi.

    // Khi máy quét có kết nối mạng (hoặc chạy theo lô Batch), nó chỉ việc báo cho Backend:
    // "Này Server, vé số XYZ tao đã xác thực nó là thật và cho qua cổng rồi nhé, update DB đi!"

    const { ticketId, scannedAt } = req.body;

    try {
        // Chỉ việc tìm vé và cập nhật trạng thái cực nhanh
        const updatedTicket = await Ticket.findByIdAndUpdate(
            ticketId,
            {
                check_in_status: true,
                check_in_time: scannedAt || new Date()
            },
            { new: true } // Trả về data mới
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