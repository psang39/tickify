import Show from '../models/show.model';
import Staff from '../models/staff.model';
import Ticket from '../models/ticket.model';
import CheckInLog from '../models/check-in-log.model';
import { verifyTicketToken } from '../config/totp.util';
import { Request, Response } from 'express';
import { Types } from 'mongoose';

const parseQrData = (qrData: string) => {
    const parts = String(qrData || '').split('|').map(part => part.trim());
    if (parts.length < 4) return null;
    return {
        ticketId: parts[0],
        ticketSecret: parts[1],
        currentTotpCode: parts[2],
        signature: parts[3],
    };
};

const getDocId = (value: any) => value?._id || value;

const getStaffProfile = async (userId: string) => {
    // Staff là discriminator của User nên _id của staff chính là _id user đăng nhập.
    return Staff.findById(userId);
};

const ensureAssignedShow = async (userId: string, showId: string) => {
    const staff = await getStaffProfile(userId);
    if (!staff) return null;

    const isAssigned = (staff.assigned_show_ids as any[] || [])
        .some(id => id.toString() === showId);

    if (!isAssigned) return null;
    return staff;
};

export const getMyAssignedShows = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const staff = await getStaffProfile(userId);

        if (!staff) {
            return res.status(404).json({ message: 'Hồ sơ nhân viên không tồn tại' });
        }

        if (!staff.assigned_show_ids || (staff.assigned_show_ids as any[]).length === 0) {
            return res.status(200).json({
                docs: [],
                totalDocs: 0,
                limit: 20,
                page: 1,
                totalPages: 1,
                hasPrevPage: false,
                hasNextPage: false,
            });
        }

        const options = {
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 20,
            sort: { start_time: 1 },
            select: 'name description start_time end_time venue_id status public_key',
            populate: { path: 'venue_id', select: 'name location' },
        };

        const paginatedShows = await Show.paginate(
            { _id: { $in: staff.assigned_show_ids } },
            options,
        );

        res.status(200).json(paginatedShows);
    } catch (error) {
        console.error('Lỗi getMyAssignedShows:', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi lấy danh sách show được gán', error });
    }
};

export const getShowById = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const show_id = req.params.show_id as string;

        const staff = await ensureAssignedShow(userId, show_id);
        if (!staff) {
            return res.status(403).json({ message: 'Bạn không được phân công cho show này' });
        }

        const show = await Show.findById(show_id)
            .select('name description start_time end_time status public_key venue_id')
            .populate('venue_id', 'name location')
            .lean({ virtuals: true } as any);

        if (!show) {
            return res.status(404).json({ message: 'Show không tồn tại' });
        }

        res.status(200).json({ data: show });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi hệ thống khi lấy show' });
    }
};

export const getShowPublicKey = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const show_id = req.params.show_id as string;

        const staff = await ensureAssignedShow(userId, show_id);
        if (!staff) {
            return res.status(403).json({ message: 'Bạn không được phân công cho show này' });
        }

        const show = await Show.findById(show_id).select('public_key start_time end_time name').lean();
        if (!show) {
            return res.status(404).json({ message: 'Show không tồn tại' });
        }

        res.status(200).json({
            data: {
                show_id,
                name: show.name,
                public_key: show.public_key,
                start_time: show.start_time,
                end_time: show.end_time,
            },
        });
    } catch (error) {
        console.error('Lỗi getShowPublicKey:', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi lấy public key' });
    }
};

export const onlineCheckIn = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const show_id = req.params.show_id as string;
        const { qrData, deviceId } = req.body;

        const staff = await ensureAssignedShow(userId, show_id);
        if (!staff) {
            res.status(403).json({ message: 'Bạn không được phân công cho show này' });
            return;
        }

        const parsed = parseQrData(qrData);
        if (!parsed) {
            res.status(400).json({ message: 'Định dạng mã QR không hợp lệ' });
            return;
        }

        const ticket = await Ticket.findOne({ _id: parsed.ticketId, show_id })
            .populate('seat_id', 'seat_number row col_index')
            .populate('ticket_type_id', 'name price')
            .lean();

        if (!ticket) {
            res.status(404).json({ message: 'Vé không thuộc show này hoặc không tồn tại' });
            return;
        }

        if (ticket.status === 'USED') {
            await CheckInLog.create({
                ticket_id: ticket._id,
                show_id,
                event_id: ticket.event_id,
                staff_id: staff._id as Types.ObjectId,
                organizer_id: (staff as any).organizer_id,
                seat_id: getDocId(ticket.seat_id),
                ticket_type_id: getDocId(ticket.ticket_type_id),
                mode: 'ONLINE',
                result: 'DUPLICATE',
                scanned_at: new Date(),
                device_id: deviceId,
                note: 'Ticket has already been used before this scan',
            });
            res.status(409).json({
                message: 'Vé này đã được sử dụng',
                status: 'USED',
                check_in_time: ticket.check_in_time,
            });
            return;
        }

        if (ticket.status === 'INVALID') {
            await CheckInLog.create({
                ticket_id: ticket._id,
                show_id,
                event_id: ticket.event_id,
                staff_id: staff._id as Types.ObjectId,
                organizer_id: (staff as any).organizer_id,
                seat_id: getDocId(ticket.seat_id),
                ticket_type_id: getDocId(ticket.ticket_type_id),
                mode: 'ONLINE',
                result: 'INVALID',
                scanned_at: new Date(),
                device_id: deviceId,
                note: 'Ticket is invalid/cancelled',
            });
            res.status(400).json({ message: 'Vé này đã bị hủy hoặc không hợp lệ', status: 'INVALID' });
            return;
        }

        const isValidTotp = await verifyTicketToken(parsed.currentTotpCode, ticket.ticket_secret);
        if (!isValidTotp) {
            await CheckInLog.create({
                ticket_id: ticket._id,
                show_id,
                event_id: ticket.event_id,
                staff_id: staff._id as Types.ObjectId,
                organizer_id: (staff as any).organizer_id,
                seat_id: getDocId(ticket.seat_id),
                ticket_type_id: getDocId(ticket.ticket_type_id),
                mode: 'ONLINE',
                result: 'EXPIRED',
                scanned_at: new Date(),
                device_id: deviceId,
                note: 'TOTP code expired or invalid',
            });
            res.status(401).json({ message: 'Mã QR đã hết hạn. Vui lòng yêu cầu khách mở lại vé' });
            return;
        }

        // Atomic update để tránh 2 máy check-in cùng một vé cùng lúc.
        const updatedTicket = await Ticket.findOneAndUpdate(
            { _id: parsed.ticketId, show_id, status: 'VALID' },
            { status: 'USED', check_in_time: new Date() },
            { new: true },
        )
            .populate('seat_id', 'seat_number row col_index')
            .populate('ticket_type_id', 'name price');

        if (!updatedTicket) {
            await CheckInLog.create({
                ticket_id: ticket._id,
                show_id,
                event_id: ticket.event_id,
                staff_id: staff._id as Types.ObjectId,
                organizer_id: (staff as any).organizer_id,
                seat_id: getDocId(ticket.seat_id),
                ticket_type_id: getDocId(ticket.ticket_type_id),
                mode: 'ONLINE',
                result: 'CONFLICT',
                scanned_at: new Date(),
                device_id: deviceId,
                note: 'Ticket status changed before atomic update completed',
            });
            res.status(409).json({ message: 'Vé này vừa được sử dụng bởi thiết bị khác', status: 'USED' });
            return;
        }

        await CheckInLog.create({
            ticket_id: updatedTicket._id,
            show_id,
            event_id: updatedTicket.event_id,
            staff_id: staff._id as Types.ObjectId,
            organizer_id: (staff as any).organizer_id,
            seat_id: getDocId(updatedTicket.seat_id),
            ticket_type_id: getDocId(updatedTicket.ticket_type_id),
            mode: 'ONLINE',
            result: 'SUCCESS',
            scanned_at: updatedTicket.check_in_time || new Date(),
            device_id: deviceId,
            note: 'Online check-in succeeded',
        });

        res.status(200).json({
            message: 'Check-in thành công. Vé đã chuyển sang USED',
            status: 'USED',
            ticketInfo: {
                ticket_id: updatedTicket._id,
                seat: updatedTicket.seat_id,
                type: updatedTicket.ticket_type_id,
                check_in_time: updatedTicket.check_in_time,
            },
        });
    } catch (error) {
        console.error('Lỗi onlineCheckIn:', error);
        res.status(500).json({ message: 'Lỗi hệ thống soát vé' });
    }
};

export const syncOfflineCheckIns = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const show_id = req.params.show_id as string;
        const { tickets, deviceId } = req.body as { tickets?: Array<{ ticketId: string; scannedAt?: string }>; deviceId?: string };

        const staff = await ensureAssignedShow(userId, show_id);
        if (!staff) {
            res.status(403).json({ message: 'Bạn không được phân công cho show này' });
            return;
        }

        if (!Array.isArray(tickets) || tickets.length === 0) {
            res.status(400).json({ message: 'Không có vé nào để đồng bộ' });
            return;
        }

        const show = await Show.findById(show_id).select('event_id').lean();
        if (!show) {
            res.status(404).json({ message: 'Show không tồn tại' });
            return;
        }

        const results = [];
        for (const item of tickets) {
            const scannedAt = item.scannedAt ? new Date(item.scannedAt) : new Date();
            const updatedTicket = await Ticket.findOneAndUpdate(
                { _id: item.ticketId, show_id, status: 'VALID' },
                { status: 'USED', check_in_time: scannedAt },
                { new: true },
            ).select('_id event_id show_id seat_id ticket_type_id status check_in_time');

            if (updatedTicket) {
                await CheckInLog.create({
                    ticket_id: updatedTicket._id,
                    show_id,
                    event_id: (updatedTicket as any).event_id,
                    staff_id: staff._id as Types.ObjectId,
                    organizer_id: (staff as any).organizer_id,
                    seat_id: (updatedTicket as any).seat_id,
                    ticket_type_id: (updatedTicket as any).ticket_type_id,
                    mode: 'OFFLINE_SYNC',
                    result: 'SUCCESS',
                    scanned_at: scannedAt,
                    synced_at: new Date(),
                    device_id: deviceId,
                    note: 'Offline scan synced successfully',
                });
                results.push({ ticketId: item.ticketId, success: true, status: 'USED', check_in_time: updatedTicket.check_in_time });
                continue;
            }

            const existing = await Ticket.findOne({ _id: item.ticketId, show_id }).select('_id event_id show_id seat_id ticket_type_id status check_in_time');
            if (!existing) {
                await CheckInLog.create({
                    show_id,
                    event_id: (show as any).event_id,
                    staff_id: staff._id as Types.ObjectId,
                    organizer_id: (staff as any).organizer_id,
                    mode: 'OFFLINE_SYNC',
                    result: 'NOT_FOUND',
                    scanned_at: scannedAt,
                    synced_at: new Date(),
                    device_id: deviceId,
                    raw_ticket_id: item.ticketId,
                    note: 'Ticket id from offline queue was not found in this show',
                }).catch(() => undefined);
                results.push({ ticketId: item.ticketId, success: false, reason: 'NOT_FOUND' });
            } else {
                await CheckInLog.create({
                    ticket_id: existing._id,
                    show_id,
                    event_id: (existing as any).event_id,
                    staff_id: staff._id as Types.ObjectId,
                    organizer_id: (staff as any).organizer_id,
                    seat_id: (existing as any).seat_id,
                    ticket_type_id: (existing as any).ticket_type_id,
                    mode: 'OFFLINE_SYNC',
                    result: existing.status === 'USED' ? 'DUPLICATE' : 'INVALID',
                    scanned_at: scannedAt,
                    synced_at: new Date(),
                    device_id: deviceId,
                    note: `Offline sync failed because ticket status is ${existing.status}`,
                });
                results.push({ ticketId: item.ticketId, success: false, reason: existing.status, check_in_time: existing.check_in_time });
            }
        }

        const successCount = results.filter(r => r.success).length;
        res.status(200).json({
            message: `Đồng bộ hoàn tất: ${successCount}/${tickets.length} vé chuyển sang USED`,
            successCount,
            failedCount: tickets.length - successCount,
            results,
        });
    } catch (error) {
        console.error('Lỗi syncOfflineCheckIns:', error);
        res.status(500).json({ message: 'Lỗi server khi đồng bộ check-in offline' });
    }
};
