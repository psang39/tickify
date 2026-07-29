import '../setup-env';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

export interface BookingFixture {
    organizerId: string;
    attendeeAId: string;
    attendeeBId: string;
    staffId: string;
    eventId: string;
    showId: string;
    zoneId: string;
    ticketTypeId: string;
    seatId: string;
    price: number;
    attendeeAToken: string;
    attendeeBToken: string;
    staffToken: string;
    checkoutToken: string;
    publicKey: string;
    privateKey: string;
    rowKey: string;
    seatLockKey: string;
    heldCountKeyForA: string;
    statusHashKey: string;
    holdingSetKey: string;
    summaryKey: string;
}

const accessTokenFor = (user: any): string => jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.SECRET_ACCESS_TOKEN as string,
    { expiresIn: '1h' },
);

export const seedBookingFixture = async (): Promise<BookingFixture> => {
    const [
        { default: Organizer },
        { default: Attendee },
        { default: Staff },
        { default: Event },
        { default: Show },
        { default: Venue },
        { default: Zone },
        { default: TicketType },
        { default: Seat },
        { default: redisClient },
        { generateRSAKeyPair, encryptPrivateKey },
    ] = await Promise.all([
        import('../../src/models/organizer.model'),
        import('../../src/models/attendee.model'),
        import('../../src/models/staff.model'),
        import('../../src/models/event.model'),
        import('../../src/models/show.model'),
        import('../../src/models/venue.model'),
        import('../../src/models/zone.model'),
        import('../../src/models/ticket-type.model'),
        import('../../src/models/seat.model'),
        import('../../src/utils/redisClient'),
        import('../../src/utils/cryptoUtils'),
    ]);

    const suffix = new mongoose.Types.ObjectId().toString();
    const now = Date.now();
    const saleStart = new Date(now - 60_000);
    const saleEnd = new Date(now + 60 * 60_000);
    const showStart = new Date(now + 2 * 60 * 60_000);
    const showEnd = new Date(now + 4 * 60 * 60_000);

    const organizer = await Organizer.create({
        email: `organizer-${suffix}@tickify.test`,
        password: 'password123',
        first_name: 'Test',
        last_name: 'Organizer',
        phone: '0900000001',
        company_name: `Tickify Test ${suffix}`,
        tax_id: `TAX-${suffix}`,
        is_verified: true,
    });

    const [attendeeA, attendeeB] = await Attendee.create([
        {
            email: `attendee-a-${suffix}@tickify.test`,
            password: 'password123',
            first_name: 'Attendee',
            last_name: 'A',
            phone: '0900000002',
        },
        {
            email: `attendee-b-${suffix}@tickify.test`,
            password: 'password123',
            first_name: 'Attendee',
            last_name: 'B',
            phone: '0900000003',
        },
    ]);

    const venue = await Venue.create({
        name: 'Tickify Test Venue',
        address: '1 Test Street',
        city: 'Ho Chi Minh City',
        capacity: 100,
        is_verified: true,
        created_by: organizer._id,
    });

    const event = await Event.create({
        name: 'Tickify Integration Event',
        description: 'Created by automated tests',
        start_date: showStart,
        end_date: showEnd,
        status: 'published',
        organizer_id: organizer._id,
    });

    const { publicKey, privateKey } = generateRSAKeyPair();
    const show = await Show.create({
        event_id: event._id,
        name: 'Tickify Integration Show',
        sale_start: saleStart,
        sale_end: saleEnd,
        start_time: showStart,
        end_time: showEnd,
        status: 'published',
        venue_id: venue._id,
        organizer_id: organizer._id,
        seatmap_status: 'ready',
        public_key: publicKey,
        encrypted_private_key: encryptPrivateKey(privateKey),
    });

    const staff = await Staff.create({
        email: `staff-${suffix}@tickify.test`,
        password: 'password123',
        first_name: 'Test',
        last_name: 'Staff',
        phone: '0900000004',
        organizer_id: organizer._id,
        assigned_show_ids: [show._id],
    });

    const zone = await Zone.create({
        name: 'VIP',
        event_id: event._id,
        show_id: show._id,
        capacity: 1,
        is_standing: false,
    });

    const price = 250_000;
    const ticketType = await TicketType.create({
        event_id: event._id,
        show_id: show._id,
        name: 'VIP Ticket',
        target_tier: 'VIP',
        price,
        sale_start: saleStart,
        sale_end: saleEnd,
        status: 'active',
    });

    zone.ticket_type_id = ticketType._id;
    await zone.save();

    const seat = await Seat.create({
        seat_number: 'A1',
        zone_id: zone._id,
        event_id: event._id,
        show_id: show._id,
        status: 'available',
        row: 'A',
        col_index: 1,
        tier: 'VIP',
        ticket_type_id: ticketType._id,
    });

    const eventId = event._id.toString();
    const showId = show._id.toString();
    const zoneId = zone._id.toString();
    const seatId = seat._id.toString();
    const ticketTypeId = ticketType._id.toString();
    const attendeeAId = attendeeA._id.toString();

    const rowKey = `event:${eventId}:show:${showId}:zone:${zoneId}:row:A`;
    const seatLockKey = `event:${eventId}:show:${showId}:seat:${seatId}:lock`;
    const heldCountKeyForA = `event:${eventId}:show:${showId}:user:${attendeeAId}:held_count`;
    const statusHashKey = `show:${showId}:seat_status`;
    const holdingSetKey = `event:${eventId}:show:${showId}:holding_seats`;
    const summaryKey = `event:${eventId}:show:${showId}:zone:${zoneId}:summary`;

    await redisClient.set(rowKey, 'O');
    await redisClient.hSet(statusHashKey, seatId, 'available');
    await redisClient.hSet(summaryKey, {
        [`tier:${ticketTypeId}:count`]: '1',
        valid_quantities: JSON.stringify([1]),
    });

    const checkoutToken = jwt.sign(
        {
            purpose: 'checkout',
            event_id: eventId,
            show_id: showId,
        },
        process.env.JWT_SECRET as string,
        { expiresIn: '15m' },
    );

    return {
        organizerId: organizer._id.toString(),
        attendeeAId,
        attendeeBId: attendeeB._id.toString(),
        staffId: staff._id.toString(),
        eventId,
        showId,
        zoneId,
        ticketTypeId,
        seatId,
        price,
        attendeeAToken: accessTokenFor(attendeeA),
        attendeeBToken: accessTokenFor(attendeeB),
        staffToken: accessTokenFor(staff),
        checkoutToken,
        publicKey,
        privateKey,
        rowKey,
        seatLockKey,
        heldCountKeyForA,
        statusHashKey,
        holdingSetKey,
        summaryKey,
    };
};

export const createPendingOrderForFixture = async (
    fixture: BookingFixture,
    options: { expired?: boolean } = {},
) => {
    const { default: Order } = await import('../../src/models/order.model');
    return Order.create({
        order_number: `TEST-${new mongoose.Types.ObjectId().toString()}`,
        user_id: fixture.attendeeAId,
        event_id: fixture.eventId,
        show_id: fixture.showId,
        zone_id: fixture.zoneId,
        items: [{
            seat_id: fixture.seatId,
            ticket_type_id: fixture.ticketTypeId,
            price: fixture.price,
        }],
        purchaser_name: 'Attendee A',
        purchaser_email: 'attendee-a@tickify.test',
        purchaser_phone: '0900000002',
        status: 'pending',
        total_price: fixture.price,
        cancellation_deadline: new Date(Date.now() + (options.expired ? -1_000 : 10 * 60_000)),
    });
};

export const markFixtureSeatAsHeld = async (fixture: BookingFixture): Promise<void> => {
    const { default: redisClient } = await import('../../src/utils/redisClient');
    await redisClient.set(fixture.rowKey, 'H');
    await redisClient.set(fixture.seatLockKey, fixture.attendeeAId, { EX: 600 });
    await redisClient.set(fixture.heldCountKeyForA, '1', { EX: 600 });
    await redisClient.hSet(fixture.statusHashKey, fixture.seatId, 'holding');
    await redisClient.sAdd(fixture.holdingSetKey, fixture.seatId);
    await redisClient.hSet(fixture.summaryKey, `tier:${fixture.ticketTypeId}:count`, '0');
};
