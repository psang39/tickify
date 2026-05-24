import User from '../models/user.model';
import Staff from '../models/staff.model';
import Ticket from '../models/ticket.model';
import Event from '../models/event.model';
import { Request, Response } from 'express';
import Show from '../models/show.model';
import bcrypt from 'bcrypt';
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

            populate: {
                path: 'user_id',
                select: 'first_name last_name email status phone'
            }
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