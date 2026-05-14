import { Request, Response } from 'express'; // Nên import type chuẩn thay vì dùng 'any'
import User from '../models/user.model';
import Organizer from '../models/organizer.model';
import Attendee from '../models/attendee.model';

import { IUser } from '../types/user.types';
import Blacklist from '../models/Blacklist';
import bcrypt from 'bcrypt';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, first_name, last_name, email, password, role, phone } = req.body;

        if (!username || !email || !password || !role || !phone) {
            res.status(400).json({ error: 'All fields are required' });
            return; // Bắt buộc phải có return để ngắt luồng chạy
        }

        // Lưu ý: Nếu bạn dùng Mongoose Discriminator, phân biệt hoa/thường rất quan trọng ('Admin' khác 'admin')
        if (!['admin', 'attendee', 'organizer', 'Admin', 'Attendee', 'Organizer'].includes(role)) {
            res.status(400).json({ error: 'Invalid role' });
            return;
        }
        if (role === 'Admin' || role === 'admin') {
            res.status(403).json({ error: 'Không được phép tạo tài khoản Admin qua cổng này' });
            return;
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ error: 'Email already exists' });
            return;
        }
        let newUser: IUser;

        if (role === 'Organizer' || role === 'organizer') {
            // Nếu là Organizer, yêu cầu Frontend phải gửi thêm company_name
            const { company_name, tax_id } = req.body;

            if (!company_name) {
                res.status(400).json({ error: 'Ban tổ chức bắt buộc phải có Tên công ty/Tổ chức' });
                return;
            }

            // Dùng model Organizer để tạo
            newUser = new Organizer({
                email, password, first_name, last_name, phone,
                company_name,
                tax_id,
                is_verified: false // Mặc định chưa duyệt
            });

        } else if (role === 'Attendee' || role === 'attendee') {
            // Nếu là Khán giả bình thường
            newUser = new Attendee({
                email, password, first_name, last_name, phone
                // Không cần trường gì thêm
            });

        } else {
            res.status(400).json({ error: 'Role không hợp lệ. Chỉ chấp nhận Organizer hoặc Attendee' });
            return;
        }

        // 4. LƯU XUỐNG DB VÀ TRẢ KẾT QUẢ
        await newUser.save(); // Hook pre('save') băm password vẫn sẽ chạy bình thường!

        res.status(201).json({
            message: 'Đăng ký tài khoản thành công',
            data: {
                id: newUser._id,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error('[Register Error]', error);
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        console.log("Email from request:", email);
        const user: IUser | null = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            res.status(400).json({ error: 'Invalid credentials' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(400).json({ error: 'Wrong password' });
            return;
        }

        const options = {
            maxAge: 20 * 60 * 1000, // 20 minutes
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Mẹo: Khi code local ở http thì để false, lên server https mới để true
            sameSite: "none" as const, // Cần ép kiểu as const trong TypeScript
        };

        const token = user.generateAccessJWT();

        res.cookie("SessionID", token, options);

        // CHỈ GỌI res.json 1 LẦN DUY NHẤT
        res.status(200).json({
            status: "success",
            message: "You have successfully logged in.",
            token: token,
            user: {
                id: user._id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role
            }
        });
        // ĐÃ XÓA dòng res.json thứ 2 và res.end()
    } catch (error) {
        console.error('[Login Error]', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const authHeader = req.headers["cookie"];

        // XỬ LÝ AN TOÀN TRÁNH TYPE ERROR
        if (!authHeader) {
            res.status(204).end(); // Không có cookie thì xem như đã đăng xuất
            return;
        }

        // Cách parse cookie thủ công (Nên cân nhắc dùng thư viện cookie-parser để code nhàn hơn)
        const cookies = authHeader.split(";").map(c => c.trim());
        const sessionCookie = cookies.find(c => c.startsWith("SessionID="));

        if (!sessionCookie) {
            res.status(204).end();
            return;
        }

        const accessToken = sessionCookie.split("=")[1];

        const checkifBlacklisted = await Blacklist.findOne({ token: accessToken });

        if (!checkifBlacklisted) {
            const newBlacklist = new Blacklist({ token: accessToken });
            await newBlacklist.save();
        }

        res.clearCookie("SessionID", {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "none"
        });

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('[Logout Error]', error);
        res.status(500).json({ error: 'Server error' });
    }
};