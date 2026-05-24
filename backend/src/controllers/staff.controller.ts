import Event from '../models/event.model';
import User from '../models/user.model';
import Show from '../models/show.model';
import Staff from '../models/staff.model';
import Ticket from '../models/ticket.model';
import { verifyTicketToken } from '../config/totp.util';
import { Request, Response } from 'express';

export const getMyAssignedShows = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;


        const staff = await Staff.findOne({ user_id: userId });

        if (!staff) {
            return res.status(404).json({ message: "Hồ sơ nhân viên không tồn tại" });
        }


        if (!staff.assigned_show_ids || (staff.assigned_show_ids as any[]).length === 0) {
            return res.status(200).json({
                docs: [],
                totalDocs: 0,
                limit: 10,
                page: 1,
                totalPages: 1,
                hasPrevPage: false,
                hasNextPage: false
            });
        }


        const filter = {
            _id: { $in: staff.assigned_show_ids }
        };



        const options = {
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 10,
            sort: { start_time: 1 },

            select: 'name description start_time end_time venue_id public_key'
        };


        const paginatedShows = await Show.paginate(filter, options);

        res.status(200).json(paginatedShows);
    } catch (error) {
        console.error("Lỗi getMyAssignedShows:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi lấy danh sách sự kiện được gán", error });
    }
};

export const getShowById = async (req: Request, res: Response) => {
    try {
        const { show_id } = req.params;
        const show = await Show.findById(show_id).select('name description start_time end_time public_key').populate('venue_id', 'name location').lean();
        if (!show) {
            return res.status(404).json({ message: "Sự kiện không tồn tại" });
        }
        res.status(200).json({ data: show });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi lấy sự kiện" });
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