export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';
export type ReservationState = 'active' | 'expired' | 'confirmed' | 'cancelled';

const toDate = (value: Date | string | null | undefined): Date | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const calculateReservationExpiry = (
    now: Date = new Date(),
    holdDurationSeconds: number = 600,
): Date => {
    if (!Number.isFinite(holdDurationSeconds) || holdDurationSeconds <= 0) {
        throw new Error('holdDurationSeconds must be a positive number');
    }

    return new Date(now.getTime() + holdDurationSeconds * 1000);
};

export const getReservationState = (
    reservation: {
        status: ReservationStatus;
        cancellation_deadline?: Date | string | null;
    },
    now: Date = new Date(),
): ReservationState => {
    if (reservation.status === 'confirmed') return 'confirmed';
    if (reservation.status === 'cancelled') return 'cancelled';

    const deadline = toDate(reservation.cancellation_deadline);
    if (!deadline || now.getTime() >= deadline.getTime()) return 'expired';

    return 'active';
};
