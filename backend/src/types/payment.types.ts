import { Document, Types } from 'mongoose';
export interface IPayment extends Document {
    _id: Types.ObjectId;
    order_id: Types.ObjectId;
    amount: number;
    payment_method: string;
    status: 'pending' | 'confirmed' | 'failed';
    transaction_id?: string;
    processed_at: Date;
}