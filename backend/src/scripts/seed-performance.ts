import 'dotenv/config';
import bcrypt from 'bcrypt';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import connectDB from '../config/db';
import redisClient, { connectRedis } from '../utils/redisClient';
import Organizer from '../models/organizer.model';
import Attendee from '../models/attendee.model';
import Venue from '../models/venue.model';
import Event from '../models/event.model';
import Show from '../models/show.model';
import Zone from '../models/zone.model';
import Seat from '../models/seat.model';
import TicketType from '../models/ticket-type.model';
import Order from '../models/order.model';
import Payment from '../models/payment.model';
import Ticket from '../models/ticket.model';
import OutboxEvent from '../models/outbox-event.model';
import { generateRSAKeyPair, encryptPrivateKey } from '../utils/cryptoUtils';
import { purgeShowRedisCache, rebuildShowRedisCache } from '../services/seatmap-cache.service';
import { clearIsolatedPerformanceExpirationQueue, closeOrderExpirationInfrastructure } from '../queues/orderExpiration.queue';

const argument = (name: string, fallback?: string) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : fallback;
};
const numberArgument = (name: string, fallback: number) => {
    const value = Number(argument(name, String(fallback)));
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
    return value;
};

const runId = argument('--run-id');
if (!runId || !/^[a-zA-Z0-9-]{3,48}$/.test(runId)) {
    throw new Error('Pass --run-id using 3-48 letters, numbers, or hyphens.');
}

const users = numberArgument('--users', 600);
const rows = numberArgument('--rows', 60);
const seatsPerRow = numberArgument('--seats-per-row', 20);
const password = argument('--password', 'perf-password')!;
const flashSaleDelaySeconds = numberArgument('--flash-sale-delay-seconds', 15);
const shouldCleanupOnly = process.argv.includes('--cleanup');
const shouldReset = process.argv.includes('--reset');
const namespace = `perf-${runId}`;

const cleanup = async () => {
    const events = await Event.find({ name: `PERF ${runId}` }).select('_id').lean() as any[];
    const eventIds = events.map(event => event._id);
    const shows = eventIds.length ? await Show.find({ event_id: { $in: eventIds } }).select('_id').lean() as any[] : [];
    const showIds = shows.map(show => show._id);

    for (const show of shows) await purgeShowRedisCache(show._id.toString());
    if (showIds.length) {
        const orders = await Order.find({ show_id: { $in: showIds } }).select('_id').lean() as any[];
        const orderIds = orders.map(order => order._id);
        await Promise.all([
            orderIds.length ? Payment.deleteMany({ order_id: { $in: orderIds } }) : Promise.resolve(),
            orderIds.length ? Ticket.deleteMany({ order_id: { $in: orderIds } }) : Promise.resolve(),
            OutboxEvent.deleteMany({ aggregate_id: { $in: orderIds.map(String) } }),
            Order.deleteMany({ show_id: { $in: showIds } }),
            Seat.deleteMany({ show_id: { $in: showIds } }),
            Zone.deleteMany({ show_id: { $in: showIds } }),
            TicketType.deleteMany({ show_id: { $in: showIds } }),
            Show.deleteMany({ _id: { $in: showIds } }),
        ]);
    }
    if (eventIds.length) await Event.deleteMany({ _id: { $in: eventIds } });
    await Promise.all([
        Venue.deleteMany({ name: `PERF Venue ${runId}` }),
        Attendee.deleteMany({ email: new RegExp(`^${namespace}-user-`) }),
        Organizer.deleteMany({ email: `${namespace}-organizer@tickify.perf` }),
    ]);
};

const main = async () => {
    await connectDB();
    await connectRedis();

    if (process.env.PERFORMANCE_QUEUE_ISOLATION === 'true') {
        if (process.env.PERFORMANCE_RUN_ID !== runId) {
            throw new Error('PERFORMANCE_RUN_ID must exactly match --run-id when queue isolation is enabled.');
        }
        await clearIsolatedPerformanceExpirationQueue();
    }

    if (shouldCleanupOnly || shouldReset) await cleanup();
    if (shouldCleanupOnly) return;

    const now = Date.now();
    const saleStart = new Date(now - 60_000);
    const saleEnd = new Date(now + 4 * 60 * 60_000);
    const showStart = new Date(now + 24 * 60 * 60_000);
    const showEnd = new Date(now + 28 * 60 * 60_000);
    const passwordHash = await bcrypt.hash(password, 10);
    const organizer = await Organizer.create({
        email: `${namespace}-organizer@tickify.perf`,
        password: passwordHash,
        first_name: 'Performance',
        last_name: 'Organizer',
        phone: '0900000000',
        company_name: `PERF ${runId}`,
        tax_id: `PERF-${runId}`,
        is_verified: true,
    });
    const venue = await Venue.create({
        name: `PERF Venue ${runId}`,
        address: 'Load Test Street',
        city: 'Ho Chi Minh City',
        capacity: rows * seatsPerRow,
        is_verified: true,
        created_by: organizer._id,
    });
    const event = await Event.create({
        name: `PERF ${runId}`,
        description: 'Scoped performance-test data. Safe to delete with --cleanup.',
        start_date: showStart,
        end_date: showEnd,
        status: 'published',
        organizer_id: organizer._id,
    });
    const { publicKey, privateKey } = generateRSAKeyPair();
    const bookingShow = await Show.create({
        event_id: event._id,
        name: `PERF booking ${runId}`,
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
    const flashSaleStart = new Date(Date.now() + flashSaleDelaySeconds * 1_000);
    const flashShow = await Show.create({
        event_id: event._id,
        name: `PERF flash ${runId}`,
        sale_start: flashSaleStart,
        sale_end: saleEnd,
        start_time: showStart,
        end_time: showEnd,
        status: 'published',
        venue_id: venue._id,
        organizer_id: organizer._id,
        seatmap_status: 'ready',
        public_key: `${publicKey}\nflash-${runId}`,
        encrypted_private_key: `${encryptPrivateKey(privateKey)}flash-${runId}`,
    });
    const ticketType = await TicketType.create({
        event_id: event._id,
        show_id: bookingShow._id,
        name: 'PERF General Admission',
        target_tier: 'PERF',
        price: 100_000,
        total_quantity: rows * seatsPerRow,
        sale_start: saleStart,
        sale_end: saleEnd,
        status: 'active',
    });
    const zone = await Zone.create({
        name: 'PERF Zone',
        event_id: event._id,
        show_id: bookingShow._id,
        capacity: rows * seatsPerRow,
        is_standing: false,
        ticket_type_id: ticketType._id,
    });
    const seats = Array.from({ length: rows * seatsPerRow }, (_, index) => {
        const row = `R${String(Math.floor(index / seatsPerRow) + 1).padStart(3, '0')}`;
        const colIndex = (index % seatsPerRow) + 1;
        return {
            seat_number: `${row}-${colIndex}`,
            zone_id: zone._id,
            event_id: event._id,
            show_id: bookingShow._id,
            status: 'available',
            row,
            col_index: colIndex,
            tier: 'PERF',
            ticket_type_id: ticketType._id,
        };
    });
    const createdSeats = await Seat.insertMany(seats, { ordered: true });
    const attendeeDocuments = Array.from({ length: users }, (_, index) => ({
        email: `${namespace}-user-${String(index + 1).padStart(5, '0')}@tickify.perf`,
        password: passwordHash,
        first_name: 'Performance',
        last_name: `User${index + 1}`,
        phone: `09${String(index + 1).padStart(8, '0')}`,
        role: 'Attendee',
    }));
    // These short-lived, per-attendee tokens are deliberately emitted only into the
    // ignored, local performance manifest. They support the preauthenticated
    // control workload, which isolates booking-path work from /auth/login and
    // bcrypt without sharing a credential between virtual users.
    const createdAttendees = await Attendee.insertMany(attendeeDocuments, { ordered: true });
    await rebuildShowRedisCache(bookingShow._id.toString());

    const manifest = {
        runId,
        generatedAt: new Date().toISOString(),
        password,
        users: createdAttendees.map(user => ({
            email: user.email,
            preissuedToken: user.generateAccessJWT(),
        })),
        booking: {
            eventId: event._id.toString(),
            showId: bookingShow._id.toString(),
            zoneId: zone._id.toString(),
            ticketTypeId: ticketType._id.toString(),
            seatIds: createdSeats.map(seat => seat._id.toString()),
            rows,
            seatsPerRow,
            seatedCapacity: createdSeats.length,
        },
        flashSale: {
            eventId: event._id.toString(),
            showId: flashShow._id.toString(),
            startsAt: flashSaleStart.toISOString(),
        },
    };
    const outputDirectory = path.resolve(process.cwd(), 'perf', 'generated');
    await mkdir(outputDirectory, { recursive: true });
    const outputFile = path.join(outputDirectory, `${runId}.json`);
    await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({ outputFile, users, seats: createdSeats.length, runId }, null, 2));
};

main()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
        if (redisClient.isOpen) await redisClient.quit();
        if (process.env.PERFORMANCE_QUEUE_ISOLATION === 'true') await closeOrderExpirationInfrastructure();
    });
