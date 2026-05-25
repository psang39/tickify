import Attendee from '../models/attendee.model';
import Organizer from '../models/organizer.model';
import { Admin } from '../models/admin.model';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const userRole = req.user?.role;
        if (!userRole) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const modelMap: Record<string, any> = {
            attendee: Attendee,
            Attendee: Attendee,
            organizer: Organizer,
            Organizer: Organizer,
            admin: Admin,
            Admin: Admin
        };

        const Model = modelMap[userRole];
        if (!Model) {
            res.status(403).json({ message: 'Invalid role' });
            return;
        }

        const user = await Model.findById(userId).select('-password');
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        res.status(200).json({ data: user });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
            res.status(400).json({ message: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
            return;
        }

        if (newPassword !== confirmPassword) {
            res.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' });
            return;
        }

        if (currentPassword === newPassword) {
            res.status(400).json({ message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.' });
            return;
        }

        const user = await Attendee.findById(userId) || await Organizer.findById(userId) || await Admin.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });
            return;
        }

        user.password = newPassword;
        user.updated_at = new Date();
        await user.save();

        res.status(200).json({ message: 'Đổi mật khẩu thành công.' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
