// file: src/controllers/admin.controller.ts
import { Request, Response } from 'express';
import User from '../models/user.model';
import Event from '../models/event.model';
import Order from '../models/order.model';

// 1. LẤY THỐNG KÊ TỔNG QUAN HỆ THỐNG
export const getSystemDashboard = async (req: Request, res: Response) => {
    try {
        // Chạy song song các query để tối ưu tốc độ bằng Promise.all
        const [totalUsers, totalEvents, pendingEvents, revenueData] = await Promise.all([
            User.countDocuments(),
            Event.countDocuments({ status: 'active' }),
            Event.countDocuments({ status: 'pending' }), // Các event chờ duyệt

            // Tính tổng tiền toàn hệ thống từ các đơn hàng đã PAID
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

// 2. LẤY DANH SÁCH NGƯỜI DÙNG (KÈM PHÂN TRANG)
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = page * limit;

        const users = await User.find()
            .select('-password') // Bắt buộc giấu mật khẩu
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments();

        res.status(200).json({
            data: users,
            total,
            hasMore: skip + users.length < total
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

// 3. XÁC THỰC BAN TỔ CHỨC (Verify Organizer)
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
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
};