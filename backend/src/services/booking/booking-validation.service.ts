import type { IOrder } from '../../types/order.types';
import { computeShowAvailability } from '../../utils/showAvailability';

export type BookingItem = {
    seat_id: string;
    ticket_type_id: string;
};

export type BookingValidationFailure = { status: number; body: Record<string, unknown> };

export const validateBookingRequest = (params: {
    eventId: string;
    showId: string;
    items: unknown;
}): BookingValidationFailure | undefined => {
    if (!params.eventId || !params.showId || !Array.isArray(params.items) || params.items.length === 0) {
        return { status: 400, body: { message: 'Dữ liệu đầu vào không hợp lệ.' } };
    }
    return undefined;
};

export const validateBookableShow = (params: {
    show: any;
    eventId: string;
}): BookingValidationFailure | undefined => {
    if (!params.show) return { status: 404, body: { message: 'Show diễn không tồn tại.' } };
    if (String(params.show.event_id) !== String(params.eventId)) {
        return { status: 400, body: { message: 'Checkout token không khớp với show hiện tại.' } };
    }
    const availability = computeShowAvailability(params.show);
    if (!availability.is_bookable) {
        return { status: 403, body: { message: availability.booking_message, availability } };
    }
    return undefined;
};

export const validateSeatSelection = <T extends { zone_id: { toString(): string } }>(
    seats: T[],
    requestedCount: number,
): BookingValidationFailure | { zoneId: string } => {
    if (seats.length !== requestedCount) {
        return { status: 400, body: { message: 'Một số ghế không tồn tại.' } };
    }
    const zoneId = seats[0].zone_id.toString();
    if (seats.some(seat => seat.zone_id.toString() !== zoneId)) {
        return { status: 400, body: { message: 'Mỗi lần giữ chỗ chỉ được chọn vé trong cùng một khu vực.' } };
    }
    return { zoneId };
};

export const validateReferencedBookingData = (params: {
    seatCount: number;
    expectedSeatCount: number;
    ticketTypeCount: number;
    expectedTicketTypeCount: number;
}): void => {
    if (
        params.seatCount !== params.expectedSeatCount
        || params.ticketTypeCount !== params.expectedTicketTypeCount
    ) {
        throw new Error('Có ghế hoặc loại vé không tồn tại trong hệ thống.');
    }
};

export const groupReservationItems = <T extends { row: string }>(items: BookingItem[], seats: T[]) => {
    const seatsByRow: Record<string, T[]> = {};
    const lockedByTier: Record<string, number> = {};

    items.forEach(item => {
        lockedByTier[item.ticket_type_id] = (lockedByTier[item.ticket_type_id] || 0) + 1;
    });
    seats.forEach(seat => {
        if (!seatsByRow[seat.row]) seatsByRow[seat.row] = [];
        seatsByRow[seat.row].push(seat);
    });

    return { seatsByRow, lockedByTier };
};

export const buildOrderTickets = (params: {
    items: BookingItem[];
    seats: any[];
    ticketTypes: any[];
    isStanding: boolean;
}): { totalPrice: number; orderTicketsData: IOrder['items'] } => {
    const { items, seats, ticketTypes, isStanding } = params;
    let totalPrice = 0;
    const orderTicketsData: IOrder['items'] = [];

    for (const item of items) {
        const seat = seats.find(candidate => candidate._id.toString() === item.seat_id);
        const selectedTicketType = ticketTypes.find(candidate => candidate._id.toString() === item.ticket_type_id);
        if (!selectedTicketType) throw new Error('Loại vé bạn chọn không tồn tại.');

        const seatTier = String(seat!.tier || '').toUpperCase();
        const ticketTier = String(selectedTicketType.target_tier || '').toUpperCase();
        if (!isStanding && seatTier !== ticketTier) {
            throw new Error(`Ghế hạng ${seat!.tier} không khớp với vé.`);
        }
        if (isStanding && seat!.ticket_type_id?.toString() !== selectedTicketType._id.toString()) {
            throw new Error('Vé GA không khớp với khu vực standing đã chọn.');
        }

        totalPrice += selectedTicketType.price;
        orderTicketsData.push({
            seat_id: seat!._id,
            ticket_type_id: selectedTicketType._id,
            price: selectedTicketType.price,
        });
    }

    return { totalPrice, orderTicketsData };
};
