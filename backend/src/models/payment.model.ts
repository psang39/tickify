import { IPayment } from '../types/payment.types';
import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema<IPayment>({
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    amount: { type: Number, required: true },
    payment_method: { type: String, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'failed'], default: 'pending' },
    transaction_id: { type: String },
    processed_at: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<IPayment>('Payment', PaymentSchema);