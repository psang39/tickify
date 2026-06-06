import Mongoose from 'mongoose';
import { IOrderItem } from '../types/order-item.types';
const OrderItemSchema = new Mongoose.Schema<IOrderItem>({
    order_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    seat_id: { type: Mongoose.Schema.Types.ObjectId, ref: 'Seat', required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    ticket_type: { type: String, required: true },
});

const OrderItem = Mongoose.model('OrderItem', OrderItemSchema);
export default OrderItem;