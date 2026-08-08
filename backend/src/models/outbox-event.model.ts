import mongoose from 'mongoose';

export type OutboxEventStatus =
    | 'pending'
    | 'publishing'
    | 'failed'
    | 'published';

export interface IOutboxEvent {
    event_id: string;
    aggregate_id: string;
    event_type: 'payment.confirmed';
    payload: Record<string, unknown>;
    status: OutboxEventStatus;
    attempts: number;
    next_attempt_at: Date;
    locked_at?: Date | null;
    published_at?: Date | null;
}

const OutboxEventSchema = new mongoose.Schema<IOutboxEvent>(
    {
        event_id: {
            type: String,
            required: true,
            unique: true,
        },
        aggregate_id: {
            type: String,
            required: true,
            index: true,
        },
        event_type: {
            type: String,
            required: true,
            enum: ['payment.confirmed'],
        },
        payload: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        status: {
            type: String,
            required: true,
            enum: ['pending', 'publishing', 'failed', 'published'],
            default: 'pending',
        },
        attempts: {
            type: Number,
            required: true,
            default: 0,
        },
        next_attempt_at: {
            type: Date,
            required: true,
            default: Date.now,
        },
        locked_at: {
            type: Date,
            default: null,
        },
        published_at: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

OutboxEventSchema.index({
    status: 1,
    next_attempt_at: 1,
    createdAt: 1,
});

const OutboxEvent = (
    mongoose.models.OutboxEvent as mongoose.Model<IOutboxEvent> | undefined
) ?? mongoose.model<IOutboxEvent>('OutboxEvent', OutboxEventSchema);

export default OutboxEvent;
