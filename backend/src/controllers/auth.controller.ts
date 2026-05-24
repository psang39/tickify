import { Request, Response } from 'express';
import User from '../models/user.model';
import Organizer from '../models/organizer.model';
import Attendee from '../models/attendee.model';

import { IUser } from '../types/user.types';
import Blacklist from '../models/blacklist.model';
import bcrypt from 'bcrypt';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, first_name, last_name, email, password, role, phone } = req.body;

        if (!username || !email || !password || !role || !phone) {
            res.status(400).json({ error: 'All fields are required' });
            return;
        }


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

            const { company_name, tax_id } = req.body;

            if (!company_name) {
                res.status(400).json({ error: 'Ban tổ chức bắt buộc phải có Tên công ty/Tổ chức' });
                return;
            }


            newUser = new Organizer({
                email, password, first_name, last_name, phone,
                company_name,
                tax_id,
                is_verified: false
            });

        } else if (role === 'Attendee' || role === 'attendee') {

            newUser = new Attendee({
                email, password, first_name, last_name, phone

            });

        } else {
            res.status(400).json({ error: 'Role không hợp lệ. Chỉ chấp nhận Organizer hoặc Attendee' });
            return;
        }


        await newUser.save();

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
            maxAge: 20 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? "none" as const : "lax" as const,
        };

        const token = user.generateAccessJWT();

        res.cookie("SessionID", token, options);


        res.status(200).json({
            status: "success",
            message: "You have successfully logged in.",
            token: token,
            user: {
                id: user._id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role.charAt(0).toUpperCase()
            }
        });

    } catch (error) {
        console.error('[Login Error]', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const authHeader = req.headers["cookie"];


        if (!authHeader) {
            res.status(204).end();
            return;
        }


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
            sameSite: process.env.NODE_ENV === 'production' ? "none" as const : "lax" as const,
        });

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('[Logout Error]', error);
        res.status(500).json({ error: 'Server error' });
    }
};