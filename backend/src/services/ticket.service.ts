import { Request, Response } from 'express';
import Ticket from '../models/ticket.model';
import Order from '../models/order.model';
import Seat from '../models/seat.model';
import { generateTicketSecret, verifyTicketToken } from '../config/totp.util';
export const generateTicketsForOrder = async (order_id: string): Promise<void> => {
    try {
        const order = await Order.findById(order_id);
        if (!order || order.status !== 'confirmed') {
            throw new Error('Đơn hàng không hợp lệ hoặc chưa thanh toán');
            return;
        }
        const ticketsToCreate = [];
        for (const seatId of order.items.map((item: any) => item.seat_id)) {
            const uniqueSecret = await generateTicketSecret();
            const seat = await Seat.findById(seatId);
            if (!seat) {
                throw new Error('Ghế không tồn tại');
                return;
            }
            ticketsToCreate.push({
                user_id: order.user_id,
                order_id: order._id,
                seat_id: seatId,
                zone_id: seat.zone_id,
                event_id: seat.event_id,
                show_id: seat.show_id,
                ticket_type_id: seat.ticket_type_id,
                ticket_secret: uniqueSecret,
                check_in_status: false,
            });
        }
        await Ticket.insertMany(ticketsToCreate);
        console.log(`Đã xuất thành công ${ticketsToCreate.length} vé cho đơn hàng ${order_id}`)
    } catch (error) {
        console.error(`[TicketService] Lỗi khi xuất vé cho order ${order_id}:`, error);
        throw new Error('Lỗi server khi xuất vé');
    }
};