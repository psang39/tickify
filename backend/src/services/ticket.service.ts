import { Request, Response } from 'express';
import Ticket from '../models/ticket.model';
import Order from '../models/order.model';
import { generateTicketSecret, verifyTicketToken } from '../config/totp.util';

export const generateTicketsForOrder = async (order_id: string): Promise<void> => {
    try {
        const order = await Order.findById(order_id);
        if (!order || order.status !== 'confirmed') {
            // res.status(400).json({ message: 'Đơn hàng không hợp lệ hoặc chưa thanh toán' });
            throw new Error('Đơn hàng không hợp lệ hoặc chưa thanh toán');
            return;
        }

        const ticketsToCreate = [];

        // Tạo vé và cấp cho mỗi vé một hạt giống (Seed) TOTP
        for (const seatId of order.seat_ids) {
            const uniqueSecret = await generateTicketSecret();

            ticketsToCreate.push({
                user_id: order.user_id,
                order_id: order._id,
                seat_id: seatId,
                ticket_secret: uniqueSecret,
                check_in_status: false,
            });
        }

        await Ticket.insertMany(ticketsToCreate);
        console.log(`Đã xuất thành công ${ticketsToCreate.length} vé cho đơn hàng ${order_id}`)
        // res.status(201).json({ message: 'Xuất vé thành công!', data: createdTickets });

    } catch (error) {
        // res.status(500).json({ message: 'Lỗi server khi xuất vé' });
        throw new Error('Lỗi server khi xuất vé');
    }
};