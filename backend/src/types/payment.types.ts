import { Document, Types } from 'mongoose';
export interface IPayment extends Document {
    _id: Types.ObjectId;
    order_id: Types.ObjectId;
    amount: number;
    payment_method: string;
    status: 'pending' | 'confirmed' | 'failed';
    transaction_id?: string;
    processed_at: Date;
    billing_info: {
        billing_name: string;
        billing_email: string;
        billing_phone: string;
    }
}