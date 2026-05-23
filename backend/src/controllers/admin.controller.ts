import { Request, Response } from 'express';
import User from '../models/user.model';
import Event from '../models/event.model';
import Order from '../models/order.model';

export const getSystemDashboard = async (req: Request, res: Response) => {
    try {
        const [totalUsers, totalEvents, pendingEvents, revenueData] = await Promise.all([
            User.countDocuments(),
            Event.countDocuments({ status: 'active' }),
            Event.countDocuments({ status: 'pending' }),
            Order.aggregate([
                { $match: { status: 'PAID' } },
                { $group: { _id: null, totalRevenue: { $sum: '$total_price' } } }
            ])
        ]);

        const totalSystemRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

        res.status(200).json({
            data: {
                totalUsers,
                totalActiveEvents: totalEvents,
                totalPendingEvents: pendingEvents,
                totalSystemRevenue
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy dữ liệu Dashboard" });
    }
};

// ==========================================
// 2. QUẢN LÝ USERS VÀ ORGANIZERS
// ==========================================
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = page * limit;

        // Nâng cấp: Cho phép lọc theo role nếu có truyền query (?role=Organizer hoặc ?role=User)
        const filter: any = {};
        if (req.query.role) {
            filter.role = req.query.role;
        }

        const users = await User.find(filter)
            .select('-password')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments(filter);

        res.status(200).json({
            data: users,
            total,
            hasMore: skip + users.length < total
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi lấy danh sách người dùng" });
    }
};

// ==========================================
// 3. XÉT DUYỆT BAN TỔ CHỨC (ORGANIZERS)
// ==========================================
export const getPendingOrganizers = async (req: Request, res: Response) => {
    try {
        // Lấy danh sách Organizer chưa được verify
        const organizers = await User.find({ role: 'Organizer', is_verified: false })
            .select('-password')
            .sort({ created_at: -1 });

        res.status(200).json({ data: organizers });
    } catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách Organizer chờ duyệt" });
    }
};

export const verifyOrganizer = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const organizer = await User.findOneAndUpdate(
            { _id: userId, role: 'Organizer' },
            { $set: { is_verified: true } },
            { new: true }
        ).select('-password');

        if (!organizer) {
            return res.status(404).json({ message: "Không tìm thấy Organizer này" });
        }

        res.status(200).json({
            message: "Đã duyệt Ban tổ chức thành công",
            data: organizer
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi phê duyệt" });
    }
};

export const rejectOrganizer = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // Phương án an toàn: Có thể xóa luôn tài khoản rác, hoặc đánh dấu status là rejected.
        // Ở đây chọn cách xóa luôn User đăng ký lỗi/ảo để dọn dẹp DB.
        const organizer = await User.findOneAndDelete({ _id: userId, role: 'Organizer', is_verified: false });

        if (!organizer) {
            return res.status(404).json({ message: "Không tìm thấy yêu cầu này" });
        }

        res.status(200).json({ message: "Đã từ chối và xóa yêu cầu đăng ký Organizer" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi từ chối Organizer" });
    }
};