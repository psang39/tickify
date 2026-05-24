import { Request, Response } from 'express';
import User from '../models/user.model';
import Event from '../models/event.model';
import Order from '../models/order.model';
import Venue from '../models/venue.model';

export const getSystemDashboard = async (req: Request, res: Response) => {
    try {
        const [totalUsers, totalEvents, pendingEvents, revenueData] = await Promise.all([
            User.countDocuments(),
            Event.countDocuments({ status: 'active' }),
            Event.countDocuments({ status: 'pending' }),
            Order.aggregate([
                { $match: { status: 'confirmed' } },
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




export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = page * limit;


        const filter: any = { role: { $ne: 'Admin' } };
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


export const getPendingOrganizers = async (req: Request, res: Response) => {
    try {

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;


        const options = {
            page,
            limit,
            select: '-password',
            sort: { created_at: -1 }
        };


        const result = await (User as any).paginate(
            { role: 'Organizer', is_verified: false },
            options
        );


        res.status(200).json({
            success: true,
            data: result.docs,
            pagination: {
                totalDocs: result.totalDocs,
                limit: result.limit,
                totalPages: result.totalPages,
                page: result.page,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage
            }
        });
    } catch (error) {
        console.error('[Get Pending Organizers Error]', error);
        res.status(500).json({ message: "Lỗi khi lấy danh sách Organizer chờ duyệt" });
    }
};

export const getVenues = async (req: Request, res: Response) => {
    try {

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;


        const options = {
            page,
            limit,
            sort: { createdAt: -1 }
        };


        const result = await (Venue as any).paginate({}, options);

        res.status(200).json({
            success: true,
            data: result.docs,
            pagination: {
                totalDocs: result.totalDocs,
                limit: result.limit,
                totalPages: result.totalPages,
                page: result.page,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage
            }
        });
    } catch (error) {
        console.error('[Get Venues Error]', error);
        res.status(500).json({ message: "Lỗi khi lấy danh sách Venue" });
    }
};
export const verifyVenue = async (req: Request, res: Response) => {
    try {
        const { venue_id } = req.params;

        const venue = await Venue.findOneAndUpdate(
            { _id: venue_id, is_verified: false },
            { $set: { is_verified: true } },
            { new: true }
        );

        if (!venue) {
            return res.status(404).json({ message: "Không tìm thấy Venue này" });
        }

        res.status(200).json({
            message: "Đã duyệt Venue thành công",
            data: venue
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi phê duyệt Venue" });
    }
};

export const rejectVenue = async (req: Request, res: Response) => {
    try {
        const { venueId } = req.params;
        const venue = await Venue.findOneAndDelete({ _id: venueId, is_verified: false });

        if (!venue) {
            return res.status(404).json({ message: "Không tìm thấy yêu cầu này" });
        }

        res.status(200).json({ message: "Đã từ chối và xóa yêu cầu đăng ký Venue" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi từ chối Venue" });
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



        const organizer = await User.findOneAndDelete({ _id: userId, role: 'Organizer', is_verified: false });

        if (!organizer) {
            return res.status(404).json({ message: "Không tìm thấy yêu cầu này" });
        }

        res.status(200).json({ message: "Đã từ chối và xóa yêu cầu đăng ký Organizer" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi từ chối Organizer" });
    }
};

export const updateVenue = async (req: Request, res: Response) => {
    try {
        const { venueId } = req.params;
        const { name, address, city, capacity, latitude, longtitude } = req.body;

        const venue = await Venue.findById(venueId);
        if (!venue) {
            return res.status(404).json({ message: "Không tìm thấy Venue này" });
        }

        if (name) venue.name = name;
        if (address) venue.address = address;
        if (city) venue.city = city;
        if (capacity) venue.capacity = capacity;
        if (latitude) venue.latitude = latitude;
        if (longtitude) venue.longitude = longtitude;

        await venue.save();

        res.status(200).json({
            message: "Cập nhật Venue thành công",
            data: venue
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi cập nhật Venue" });
    }
};