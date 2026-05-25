import User from '../models/user.model';
import Staff from '../models/staff.model';
import Ticket from '../models/ticket.model';
import Event from '../models/event.model';
import { Request, Response } from 'express';
import Show from '../models/show.model';
import bcrypt from 'bcrypt';
import Order from '../models/order.model';
import CheckInLog from '../models/check-in-log.model';
import mongoose from 'mongoose';
export const createStaffAccount = async (req: Request, res: Response) => {
    try {
        const organizerId = req.user!.id;
        const { email, password, first_name, last_name, phone } = req.body;

        if (!email || !password || !first_name || !last_name || !phone) {
            return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin nhân viên" });
        }


        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email này đã được sử dụng trong hệ thống" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);


        const newStaff = new Staff({
            email,
            password: hashedPassword,
            first_name,
            last_name,
            role: 'Staff',
            organizer_id: organizerId,
            phone,
            assigned_show_ids: []
        });


        const savedStaff = await newStaff.save();

        return res.status(201).json({
            message: "Tạo tài khoản nhân viên thành công!",
            staff: {
                _id: savedStaff._id,
                email: savedStaff.email,
                name: `${savedStaff.first_name} ${savedStaff.last_name}`
            }
        });
    } catch (error) {
        console.error("Lỗi tạo Staff:", error);
        return res.status(500).json({ message: "Lỗi hệ thống khi tạo nhân viên", error });
    }
};

export const getOrganizerStaffs = async (req: Request, res: Response) => {
    try {
        const organizerId = req.user!.id;


        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const filter = { organizer_id: organizerId };
        const options = {
            page,
            limit,
            sort: { createdAt: -1 },
            select: '_id first_name last_name email status phone assigned_show_ids created_at'

        };



        const paginatedStaffs = await (Staff as any).paginate(filter, options);

        return res.status(200).json(paginatedStaffs);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách Staff:", error);
        return res.status(500).json({ message: "Lỗi hệ thống khi lấy danh sách nhân viên", error });
    }
};

export const assignStaffToShow = async (req: Request, res: Response) => {
    try {
        const organizerId = req.user!.id;
        const { staff_id, show_id } = req.body;

        if (!staff_id || !show_id) {
            return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ staff_id và show_id" });
        }
        const show = await Show.findOne({ _id: show_id, organizer_id: organizerId });
        if (!show) {
            return res.status(403).json({ message: "Bạn không có quyền quản lý hoặc gán việc cho Show này" });
        }
        const staff = await Staff.findOne({ _id: staff_id, organizer_id: organizerId });
        if (!staff) {
            return res.status(404).json({ message: "Nhân viên không tồn tại hoặc không thuộc quyền quản lý của bạn" });
        }
        if ((staff.assigned_show_ids as any[]).includes(show_id)) {
            return res.status(400).json({ message: "Nhân viên này đã được gán vào show này từ trước" });
        }
        await Staff.updateOne(
            { _id: staff_id },
            { $addToSet: { assigned_show_ids: show_id } }
        );

        return res.status(200).json({
            message: `Gán nhân viên thành công vào Đêm diễn: ${show.name}`
        });
    } catch (error) {
        console.error("Lỗi khi gán Staff vào Show:", error);
        return res.status(500).json({ message: "Lỗi hệ thống khi phân công lịch làm việc", error });
    }
};

export const removeStaffFromShow = async (req: Request, res: Response) => {
    try {
        const organizerId = req.user!.id;
        const { staff_id, show_id } = req.body;

        if (!staff_id || !show_id) {
            return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ staff_id và show_id" });
        }
        const show = await Show.findOne({ _id: show_id, organizer_id: organizerId });
        if (!show) {
            return res.status(403).json({ message: "Bạn không có quyền chỉnh sửa nhân sự của Show này" });
        }

        const staff = await Staff.findOne({ _id: staff_id, organizer_id: organizerId });
        if (!staff) {
            return res.status(404).json({ message: "Nhân viên không tồn tại trong hệ thống của bạn" });
        }

        await Staff.updateOne(
            { _id: staff_id },
            { $pull: { assigned_show_ids: show_id } }
        );

        return res.status(200).json({
            message: `Đã rút nhân viên khỏi Đêm diễn: ${show.name} thành công!`
        });
    } catch (error) {
        console.error("Lỗi khi rút Staff khỏi Show:", error);
        return res.status(500).json({ message: "Lỗi hệ thống khi hủy phân công lịch làm việc", error });
    }
};

export const getOrganizerDashboard = async (req: Request, res: Response) => {
    try {
        const organizerId = req.user!.id; // Lấy từ middleware xác thực token

        const myEvents = await Event.find({ organizer_id: organizerId }).select('_id');
        const myEventIds = myEvents.map(e => e._id);
        const totalActiveEvents = await Event.countDocuments({
            organizer_id: organizerId,
            status: 'published'
        });

        const ticketStats = await Ticket.aggregate([
            { $match: { event_id: { $in: myEventIds } } },
            {
                $lookup: {
                    from: 'tickettypes',
                    localField: 'ticket_type_id',
                    foreignField: '_id',
                    as: 'type_info'
                }
            },
            { $unwind: '$type_info' },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$type_info.price' },
                    totalTickets: { $sum: 1 }
                }
            }
        ]);

        const totalSystemRevenue = ticketStats[0]?.totalRevenue || 0;
        const totalTicketsSold = ticketStats[0]?.totalTickets || 0;

        // 4. Lấy danh sách 5 Đêm diễn sắp sửa diễn ra nhất để hiển thị lịch nhắc nhở
        const upcomingShows = await Show.find({
            event_id: { $in: myEventIds },
            start_time: { $gte: new Date() } // Chỉ lấy các show từ thời điểm hiện tại trở về sau
        })
            .sort({ start_time: 1 }) // Xếp show gần nhất lên đầu
            .limit(5)
            .populate('event_id', 'name'); // Lấy thêm tên Sự kiện cha để hiển thị trên UI

        // 5. Trả về cấu trúc dữ liệu khít hoàn toàn với các trường hiển thị ở Frontend
        return res.status(200).json({
            success: true,
            data: {
                totalActiveEvents,
                totalSystemRevenue,
                totalTicketsSold,
                upcomingShows
            }
        });

    } catch (error) {
        console.error("Lỗi xử lý dữ liệu vĩ mô Dashboard:", error);
        return res.status(500).json({ message: "Lỗi hệ thống khi tải báo cáo thống kê", error });
    }
};

const toObjectId = (value?: string) => value && mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : undefined;

const buildOrganizerScope = async (organizerId: string, eventId?: string, showId?: string) => {
    const filter: any = { organizer_id: organizerId };
    if (eventId) filter.event_id = eventId;
    if (showId) filter._id = showId;

    const shows = await Show.find(filter).select('_id event_id name start_time end_time status').lean();
    const showIds = shows.map((show: any) => show._id);
    const eventIds = Array.from(new Set(shows.map((show: any) => show.event_id?.toString()).filter(Boolean)))
        .map(id => new mongoose.Types.ObjectId(id));

    return { shows, showIds, eventIds };
};

export const getOrganizerAnalyticsDashboard = async (req: Request, res: Response) => {
    try {
        const organizerId = req.user!.id;
        const eventId = req.query.event_id as string | undefined;
        const showId = req.query.show_id as string | undefined;
        const { shows, showIds, eventIds } = await buildOrganizerScope(organizerId, eventId, showId);

        const [eventCount, showCount, staffCount, confirmedOrders, ticketStatusStats, revenueByShow, ticketTypeBreakdown, checkInStats, recentCheckIns, upcomingShows] = await Promise.all([
            Event.countDocuments(eventId ? { _id: eventId, organizer_id: organizerId } : { organizer_id: organizerId }),
            Show.countDocuments(showId ? { _id: showId, organizer_id: organizerId } : { organizer_id: organizerId, ...(eventId ? { event_id: eventId } : {}) }),
            Staff.countDocuments({ organizer_id: organizerId }),
            Order.aggregate([
                { $match: { show_id: { $in: showIds }, status: 'confirmed' } },
                { $group: { _id: null, totalRevenue: { $sum: '$total_price' }, totalOrders: { $sum: 1 }, avgOrderValue: { $avg: '$total_price' } } },
            ]),
            Ticket.aggregate([
                { $match: { show_id: { $in: showIds } } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            Order.aggregate([
                { $match: { show_id: { $in: showIds }, status: 'confirmed' } },
                { $group: { _id: '$show_id', revenue: { $sum: '$total_price' }, orders: { $sum: 1 }, tickets: { $sum: { $size: '$items' } } } },
                { $lookup: { from: 'shows', localField: '_id', foreignField: '_id', as: 'show' } },
                { $unwind: '$show' },
                { $project: { _id: 0, show_id: '$_id', show_name: '$show.name', revenue: 1, orders: 1, tickets: 1 } },
                { $sort: { revenue: -1 } },
                { $limit: 8 },
            ]),
            Ticket.aggregate([
                { $match: { show_id: { $in: showIds } } },
                { $lookup: { from: 'tickettypes', localField: 'ticket_type_id', foreignField: '_id', as: 'ticketType' } },
                { $unwind: '$ticketType' },
                { $group: { _id: '$ticketType.name', tickets: { $sum: 1 }, revenue: { $sum: '$ticketType.price' } } },
                { $project: { _id: 0, ticket_type: '$_id', tickets: 1, revenue: 1 } },
                { $sort: { tickets: -1 } },
            ]),
            CheckInLog.aggregate([
                { $match: { show_id: { $in: showIds } } },
                { $group: { _id: '$result', count: { $sum: 1 } } },
            ]),
            CheckInLog.find({ show_id: { $in: showIds } })
                .sort({ scanned_at: -1 })
                .limit(10)
                .populate('staff_id', 'first_name last_name email')
                .populate('show_id', 'name start_time')
                .populate('seat_id', 'seat_number row col_index')
                .populate('ticket_type_id', 'name')
                .lean(),
            Show.find({ _id: { $in: showIds }, start_time: { $gte: new Date() } })
                .sort({ start_time: 1 })
                .limit(5)
                .populate('event_id', 'name')
                .lean(),
        ]);

        const ticketStatus = ticketStatusStats.reduce((acc: any, item: any) => {
            acc[item._id] = item.count;
            return acc;
        }, { VALID: 0, USED: 0, INVALID: 0 });

        const checkIns = checkInStats.reduce((acc: any, item: any) => {
            acc[item._id] = item.count;
            return acc;
        }, { SUCCESS: 0, DUPLICATE: 0, INVALID: 0, EXPIRED: 0, NOT_FOUND: 0, CONFLICT: 0, ERROR: 0 });

        const totalTickets = Object.values(ticketStatus).reduce((sum: number, value: any) => sum + Number(value || 0), 0);
        const usedTickets = Number(ticketStatus.USED || 0);

        return res.status(200).json({
            success: true,
            data: {
                filters: { event_id: eventId || null, show_id: showId || null },
                overview: {
                    totalEvents: eventCount,
                    totalShows: showCount,
                    totalStaffs: staffCount,
                    totalRevenue: confirmedOrders[0]?.totalRevenue || 0,
                    totalOrders: confirmedOrders[0]?.totalOrders || 0,
                    avgOrderValue: Math.round(confirmedOrders[0]?.avgOrderValue || 0),
                    totalTickets,
                    validTickets: ticketStatus.VALID || 0,
                    usedTickets,
                    invalidTickets: ticketStatus.INVALID || 0,
                    checkInRate: totalTickets ? Math.round((usedTickets / totalTickets) * 100) : 0,
                },
                ticketStatus,
                checkIns,
                revenueByShow,
                ticketTypeBreakdown,
                recentCheckIns,
                upcomingShows,
                showOptions: shows,
                eventOptions: eventIds,
            },
        });
    } catch (error) {
        console.error('Lỗi getOrganizerAnalyticsDashboard:', error);
        return res.status(500).json({ message: 'Không thể tải dashboard thống kê event/show', error });
    }
};

export const getOrganizerCheckInHistory = async (req: Request, res: Response) => {
    try {
        const organizerId = req.user!.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const eventId = toObjectId(req.query.event_id as string | undefined);
        const showId = toObjectId(req.query.show_id as string | undefined);
        const staffId = toObjectId(req.query.staff_id as string | undefined);
        const result = req.query.result as string | undefined;

        const filter: any = { organizer_id: organizerId };
        if (eventId) filter.event_id = eventId;
        if (showId) filter.show_id = showId;
        if (staffId) filter.staff_id = staffId;
        if (result) filter.result = result;

        const options = {
            page,
            limit,
            sort: { scanned_at: -1 },
            populate: [
                { path: 'staff_id', select: 'first_name last_name email' },
                { path: 'event_id', select: 'name' },
                { path: 'show_id', select: 'name start_time' },
                { path: 'seat_id', select: 'seat_number row col_index' },
                { path: 'ticket_type_id', select: 'name' },
            ],
        };

        const logs = await (CheckInLog as any).paginate(filter, options);
        return res.status(200).json(logs);
    } catch (error) {
        console.error('Lỗi getOrganizerCheckInHistory:', error);
        return res.status(500).json({ message: 'Không thể tải lịch sử check-in', error });
    }
};

export const getOrganizerStaffDetail = async (req: Request, res: Response) => {
    try {
        const organizerId = req.user!.id;
        const staff_id = req.params.staff_id as string;

        const staff = await Staff.findOne({ _id: staff_id, organizer_id: organizerId })
            .select('_id first_name last_name email phone assigned_show_ids created_at')
            .populate({ path: 'assigned_show_ids', select: 'name start_time end_time status event_id', populate: { path: 'event_id', select: 'name' } })
            .lean();

        if (!staff) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });

        const checkInStats = await CheckInLog.aggregate([
            { $match: { organizer_id: new mongoose.Types.ObjectId(organizerId), staff_id: new mongoose.Types.ObjectId(staff_id) } },
            { $group: { _id: '$result', count: { $sum: 1 } } },
        ]);

        return res.status(200).json({ data: { staff, checkInStats } });
    } catch (error) {
        console.error('Lỗi getOrganizerStaffDetail:', error);
        return res.status(500).json({ message: 'Không thể tải chi tiết nhân viên', error });
    }
};
