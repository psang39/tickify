import { Request, Response } from 'express';
import Ticket from '../models/ticket.model';
import Order from '../models/order.model';
import Seat from '../models/seat.model';
import Show from '../models/show.model';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { decryptPrivateKey } from '../utils/cryptoUtils';
import { generateTicketSecret, verifyTicketToken } from '../config/totp.util';
export const generateTicketsForOrder = async (order_id: string): Promise<void> => {
    try {
        const order = await Order.findById(order_id);
        if (!order || order.status !== 'confirmed') {
            throw new Error('Đơn hàng không hợp lệ hoặc chưa thanh toán');
        }

        const ticketsToCreate = [];



        const decryptedKeysCache: Record<string, string> = {};

        for (const seatId of order.items.map((item: any) => item.seat_id)) {
            const seat = await Seat.findById(seatId);
            if (!seat) {
                throw new Error('Ghế không tồn tại');
            }

            const showIdStr = seat.show_id.toString();


            if (!decryptedKeysCache[showIdStr]) {
                const show = await Show.findById(seat.show_id).select('encrypted_private_key');
                if (!show || !show.encrypted_private_key) {
                    throw new Error(`Không tìm thấy khóa bảo mật cho Đêm diễn của ghế ${seat.seat_number}`);
                }


                decryptedKeysCache[showIdStr] = decryptPrivateKey(show.encrypted_private_key);
            }


            const currentShowPrivateKey = decryptedKeysCache[showIdStr];


            const ticketId = new mongoose.Types.ObjectId();
            const uniqueSecret = await generateTicketSecret();


            const payloadToSign = `${ticketId}|${uniqueSecret}`;
            const signer = crypto.createSign('RSA-SHA256');
            signer.update(payloadToSign);
            const signature = signer.sign(currentShowPrivateKey, 'base64');


            ticketsToCreate.push({
                _id: ticketId,
                user_id: order.user_id,
                order_id: order._id,
                seat_id: seatId,
                zone_id: seat.zone_id,
                event_id: seat.event_id,
                show_id: seat.show_id,
                ticket_type_id: seat.ticket_type_id,
                ticket_secret: uniqueSecret,
                signature: signature,
                check_in_status: false,
            });
        }


        await Ticket.insertMany(ticketsToCreate);
        console.log(`Đã xuất thành công ${ticketsToCreate.length} vé kèm chữ ký số cho đơn hàng ${order_id}`);

    } catch (error) {
        console.error(`[TicketService] Lỗi khi xuất vé cho order ${order_id}:`, error);
        throw new Error('Lỗi server khi xuất vé');
    }
};