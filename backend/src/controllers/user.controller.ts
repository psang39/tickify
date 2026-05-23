import Attendee from '../models/attendee.model';
import Organizer from '../models/organizer.model';
import { Admin } from '../models/admin.model';
import { Request, Response } from 'express';

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