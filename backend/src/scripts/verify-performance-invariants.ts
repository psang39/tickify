import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import connectDB from '../config/db';
import redisClient, { connectRedis } from '../utils/redisClient';
import Order from '../models/order.model';
import Seat from '../models/seat.model';
import Payment from '../models/payment.model';
import Ticket from '../models/ticket.model';
import Show from '../models/show.model';
import Zone from '../models/zone.model';

const manifestPath = process.argv[process.argv.indexOf('--manifest') + 1];
if (!manifestPath || manifestPath === '--manifest') {
    throw new Error('Pass --manifest perf/generated/<run-id>.json');
}

const objectId = (value: any) => value?._id?.toString?.() || value?.toString?.() || String(value);

const main = async () => {
    await connectDB();
    await connectRedis();
    const manifest = JSON.parse(await readFile(path.resolve(process.cwd(), manifestPath), 'utf8'));
    const showId = manifest.booking.showId;
    const show = await Show.findById(showId).select('event_id').lean() as any;
    if (!show) throw new Error(`Show ${showId} does not exist.`);
    const eventId = objectId(show.event_id);
    const [orders, seats, zones] = await Promise.all([
        Order.find({ show_id: showId }).lean() as Promise<any[]>,
        Seat.find({ show_id: showId }).lean() as Promise<any[]>,
        Zone.find({ show_id: showId }).lean() as Promise<any[]>,
    ]);
    const orderIds = orders.map(order => objectId(order._id));
    const [payments, tickets] = await Promise.all([
        Payment.find({ order_id: { $in: orderIds } }).lean() as Promise<any[]>,
        Ticket.find({ show_id: showId }).lean() as Promise<any[]>,
    ]);
    const violations: string[] = [];
    const activeOwners = new Map<string, string[]>();
    const seatById = new Map(seats.map(seat => [objectId(seat._id), seat]));
    const ticketsByOrder = new Map<string, any[]>();
    for (const ticket of tickets) {
        const id = objectId(ticket.order_id);
        ticketsByOrder.set(id, [...(ticketsByOrder.get(id) || []), ticket]);
    }
    const paymentsByOrder = new Map<string, any[]>();
    for (const payment of payments) {
        const id = objectId(payment.order_id);
        paymentsByOrder.set(id, [...(paymentsByOrder.get(id) || []), payment]);
    }

    for (const order of orders) {
        const id = objectId(order._id);
        const seatIds = (order.items || []).map((item: any) => objectId(item.seat_id));
        if (['pending', 'confirmed'].includes(order.status)) {
            for (const seatId of seatIds) activeOwners.set(seatId, [...(activeOwners.get(seatId) || []), id]);
        }
        for (const seatId of seatIds) {
            const seat = seatById.get(seatId);
            if (!seat) { violations.push(`order ${id} references missing seat ${seatId}`); continue; }
            const rowKey = `event:${eventId}:show:${showId}:zone:${objectId(seat.zone_id)}:row:${seat.row}`;
            const row = await redisClient.get(rowKey);
            const position = Number(seat.col_index) - 1;
            const redisStatus = row?.[position] || null;
            const lockKey = `event:${eventId}:show:${showId}:seat:${seatId}:lock`;
            const lock = await redisClient.get(lockKey);
            const dynamic = await redisClient.hGet(`show:${showId}:seat_status`, seatId);
            if (order.status === 'confirmed') {
                const matchedTickets = ticketsByOrder.get(id) || [];
                if (seat.status !== 'sold') violations.push(`confirmed ${id} has durable ${seatId}=${seat.status}`);
                if (redisStatus !== 'S') violations.push(`confirmed ${id} has Redis ${seatId}=${redisStatus}`);
                if (lock) violations.push(`confirmed ${id} retains ${seatId} lock=${lock}`);
                if (dynamic !== 'sold') violations.push(`confirmed ${id} has dynamic ${seatId}=${dynamic}`);
                if (matchedTickets.filter(ticket => objectId(ticket.seat_id) === seatId).length !== 1) {
                    violations.push(`confirmed ${id} has invalid ticket count for ${seatId}`);
                }
                if ((paymentsByOrder.get(id) || []).length !== 1) violations.push(`confirmed ${id} has invalid payment count`);
            }
            if (order.status === 'cancelled') {
                const successor = activeOwners.get(seatId)?.some(owner => owner !== id);
                if (!successor && (redisStatus === 'H' || lock || dynamic === 'holding')) {
                    violations.push(`cancelled ${id} retains active Redis state for ${seatId}`);
                }
            }
        }
    }
    for (const [seatId, owners] of activeOwners) {
        if (owners.length > 1) violations.push(`seat ${seatId} has multiple active orders: ${owners.join(', ')}`);
    }
    const soldSeats = new Set(seats.filter(seat => seat.status === 'sold').map(seat => objectId(seat._id)));
    for (const seatId of soldSeats) {
        if (tickets.filter(ticket => objectId(ticket.seat_id) === seatId).length !== 1) {
            violations.push(`sold seat ${seatId} does not have exactly one ticket`);
        }
    }
    const report = {
        runId: manifest.runId,
        checkedAt: new Date().toISOString(),
        counts: { orders: orders.length, seats: seats.length, payments: payments.length, tickets: tickets.length, zones: zones.length },
        violations,
    };
    const results = path.resolve(process.cwd(), 'perf', 'results');
    await mkdir(results, { recursive: true });
    const output = path.join(results, `invariants-${manifest.runId}-${Date.now()}.json`);
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ...report, output }, null, 2));
    if (violations.length) process.exitCode = 1;
};

main()
    .catch(error => { console.error(error); process.exitCode = 1; })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
        if (redisClient.isOpen) await redisClient.quit();
    });
