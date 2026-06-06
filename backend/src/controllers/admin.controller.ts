import { Request, Response } from 'express';
import User from '../models/user.model';
import Event from '../models/event.model';
import Order from '../models/order.model';
import Venue from '../models/venue.model';
import Show from '../models/show.model';

export const getSystemDashboard = async (_req: Request, res: Response) => {
    try {
        const [totalUsers, publishedEvents, draftEvents, cancelledEvents, pendingVenues, revenueData] = await Promise.all([
            User.countDocuments(),
            Event.countDocuments({ status: 'published' }),
            Event.countDocuments({ status: 'draft' }),
            Event.countDocuments({ status: 'cancelled' }),
            Venue.countDocuments({ is_verified: false }),
            Order.aggregate([
                { $match: { status: 'confirmed' } },
                { $group: { _id: null, totalRevenue: { $sum: '$total_price' } } }
            ])
        ]);

        const totalSystemRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

        res.status(200).json({
            data: {
                totalUsers,
                // Giữ lại tên field cũ để frontend hiện tại không bị vỡ.
                totalActiveEvents: publishedEvents,
                totalPendingEvents: draftEvents,
                totalSystemRevenue,
                // Field mới rõ nghĩa hơn cho các màn hình/báo cáo sau này.
                totalPublishedEvents: publishedEvents,
                totalDraftEvents: draftEvents,
                totalCancelledEvents: cancelledEvents,
                totalPendingVenues: pendingVenues
            }
        });
    } catch (error) {
        console.error('[Admin Dashboard Error]', error);
        res.status(500).json({ message: 'Lỗi khi lấy dữ liệu Dashboard' });
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
        console.error('[Get Users Error]', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi lấy danh sách người dùng' });
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
        res.status(500).json({ message: 'Lỗi khi lấy danh sách Organizer chờ duyệt' });
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
        res.status(500).json({ message: 'Lỗi khi lấy danh sách Venue' });
    }
};

export const verifyVenue = async (req: Request, res: Response) => {
    try {
        const venue_id = req.params.venue_id || req.params.venueId;

        const venue = await Venue.findOneAndUpdate(
            { _id: venue_id, is_verified: false },
            { $set: { is_verified: true } },
            { new: true }
        );

        if (!venue) {
            return res.status(404).json({ message: 'Không tìm thấy Venue này hoặc Venue đã được duyệt trước đó' });
        }

        res.status(200).json({
            message: 'Đã duyệt Venue thành công',
            data: venue
        });
    } catch (error) {
        console.error('[Verify Venue Error]', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi phê duyệt Venue' });
    }
};

export const rejectVenue = async (req: Request, res: Response) => {
    try {
        const venue_id = req.params.venue_id || req.params.venueId;
        const venue = await Venue.findOneAndDelete({ _id: venue_id, is_verified: false });

        if (!venue) {
            return res.status(404).json({ message: 'Không tìm thấy yêu cầu Venue đang chờ duyệt' });
        }

        res.status(200).json({ message: 'Đã từ chối và xóa yêu cầu đăng ký Venue' });
    } catch (error) {
        console.error('[Reject Venue Error]', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi từ chối Venue' });
    }
};

export const updateVenue = async (req: Request, res: Response) => {
    try {
        const venue_id = req.params.venue_id || req.params.venueId;
        const { name, address, city, capacity, latitude, longitude, longtitude } = req.body;

        const updatePayload: Record<string, any> = {};
        if (name !== undefined) updatePayload.name = String(name).trim();
        if (address !== undefined) updatePayload.address = String(address).trim();
        if (city !== undefined) updatePayload.city = String(city).trim();
        if (capacity !== undefined && capacity !== '') updatePayload.capacity = Number(capacity);
        if (latitude !== undefined && latitude !== '') updatePayload.latitude = Number(latitude);
        const normalizedLongitude = longitude ?? longtitude;
        if (normalizedLongitude !== undefined && normalizedLongitude !== '') updatePayload.longitude = Number(normalizedLongitude);

        if (updatePayload.name === '' || updatePayload.address === '' || updatePayload.city === '') {
            return res.status(400).json({ message: 'Tên địa điểm, địa chỉ và thành phố không được để trống.' });
        }

        const venue = await Venue.findByIdAndUpdate(
            venue_id,
            { $set: updatePayload },
            { new: true, runValidators: true }
        );

        if (!venue) {
            return res.status(404).json({ message: 'Không tìm thấy Venue này' });
        }

        res.status(200).json({
            message: 'Cập nhật Venue thành công',
            data: venue
        });
    } catch (error) {
        console.error('[Update Venue Error]', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật Venue' });
    }
};

export const deleteVenue = async (req: Request, res: Response) => {
    try {
        const venue_id = req.params.venue_id || req.params.venueId;

        const usedByShow = await Show.exists({ venue_id });
        if (usedByShow) {
            return res.status(400).json({
                message: 'Không thể xóa Venue vì đã được sử dụng bởi ít nhất một Show. Hãy hủy/chỉnh Show trước khi xóa địa điểm.'
            });
        }

        const venue = await Venue.findByIdAndDelete(venue_id);
        if (!venue) {
            return res.status(404).json({ message: 'Không tìm thấy Venue này' });
        }

        res.status(200).json({ message: 'Đã xóa Venue khỏi hệ thống' });
    } catch (error) {
        console.error('[Delete Venue Error]', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi xóa Venue' });
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
            return res.status(404).json({ message: 'Không tìm thấy Organizer này' });
        }

        res.status(200).json({
            message: 'Đã duyệt Ban tổ chức thành công',
            data: organizer
        });
    } catch (error) {
        console.error('[Verify Organizer Error]', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi phê duyệt' });
    }
};

export const rejectOrganizer = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const organizer = await User.findOneAndDelete({ _id: userId, role: 'Organizer', is_verified: false });

        if (!organizer) {
            return res.status(404).json({ message: 'Không tìm thấy yêu cầu này' });
        }

        res.status(200).json({ message: 'Đã từ chối và xóa yêu cầu đăng ký Organizer' });
    } catch (error) {
        console.error('[Reject Organizer Error]', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi từ chối Organizer' });
    }
};
