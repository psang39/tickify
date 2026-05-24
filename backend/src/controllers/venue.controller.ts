import Venue from '../models/venue.model';
import { Request, Response } from 'express';

export const createVenue = async (req: Request, res: Response) => {
    try {
        const { name, address, city, capacity, latitude, longtitude } = req.body;
        if (!name || !address || !city) {
            return res.status(400).json({ message: "Name, address, and city are required" });
        }
        const existingVenue = await Venue.findOne({ name, address, city });
        if (existingVenue) {
            return res.status(409).json({ message: "Venue with the same name and address already exists" });
        }
        const venue = new Venue({ name, address, city, capacity, latitude, longtitude, is_verified: req.user?.role === 'Admin' ? true : false, created_by: req.user?.role === 'Admin' ? null : req.user?.id });
        await venue.save();
        res.status(201).json(venue);
    }
    catch (error) {
        res.status(500).json({ message: "Error creating venue", error });
    }
};

export const getVenues = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string || ''; // 🌟 Nhận từ khóa tìm kiếm
        const user_id = (req as any).user?.id;

        const options = {
            page,
            limit,
            sort: { createdAt: -1 }
        };

        const query = {
            name: { $regex: search, $options: 'i' }, // 🌟 Tìm Venue có tên khớp với từ khóa
            $or: [
                { is_verified: true },
                { is_verified: false, created_by: user_id }
            ]
        };

        const result = await (Venue as any).paginate(query, options);

        res.status(200).json({
            success: true,
            data: result.docs,
            pagination: { totalDocs: result.totalDocs, totalPages: result.totalPages, page: result.page }
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống khi lấy danh sách Venue" });
    }
};