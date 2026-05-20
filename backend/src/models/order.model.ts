import Mongoose from 'mongoose';
import { IOrder } from '../types/order.types';

const OrderSchema = new Mongoose.Schema<IOrder>({
    order_number: { type: String, required: true, unique: true },
    user_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Attendee', required: true },
    event_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    show_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    zone_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    items: [{
        seat_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Seat', required: true },
        ticket_type_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'TicketType', required: true },
        price: { type: Number, required: true }
    }],
    purchaser_name: { type: String, required: true },
    purchaser_email: { type: String, required: true },
    purchaser_phone: { type: String, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
    total_price: { type: Number, required: true },
    created_at: { type: Date, default: Date.now },
    cancellation_deadline: { type: Date },
    discount_amount: { type: Number, default: 0 },
    promo_code: { type: String }
});

const Order = Mongoose.model('Order', OrderSchema);
export default Order;

