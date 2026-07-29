import '../setup-env';
import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';

import {
    calculateReservationExpiry,
    getReservationState,
} from '../../src/domain/reservation';
import {
    assertOrderTransition,
    canTransitionOrder,
} from '../../src/domain/order-transition';
import { hasAnyRole } from '../../src/domain/permissions';
import {
    createTicketQrPayload,
    parseTicketQrPayload,
    signTicketIdentity,
    verifyTicketQrSignature,
} from '../../src/domain/qr-payload';
import { computeShowAvailability } from '../../src/utils/showAvailability';
import { isRedisUnavailableError } from '../../src/utils/redisErrors';

test('reservation expiry is calculated from the supplied clock', () => {
    const now = new Date('2026-07-29T00:00:00.000Z');
    assert.equal(
        calculateReservationExpiry(now, 600).toISOString(),
        '2026-07-29T00:10:00.000Z',
    );
});

test('reservation state distinguishes active, expired, confirmed and cancelled', () => {
    const now = new Date('2026-07-29T00:10:00.000Z');

    assert.equal(getReservationState({
        status: 'pending',
        cancellation_deadline: '2026-07-29T00:11:00.000Z',
    }, now), 'active');

    assert.equal(getReservationState({
        status: 'pending',
        cancellation_deadline: '2026-07-29T00:10:00.000Z',
    }, now), 'expired');

    assert.equal(getReservationState({ status: 'confirmed' }, now), 'confirmed');
    assert.equal(getReservationState({ status: 'cancelled' }, now), 'cancelled');
});

test('order transition policy only permits pending to confirmed or cancelled', () => {
    assert.equal(canTransitionOrder('pending', 'confirmed'), true);
    assert.equal(canTransitionOrder('pending', 'cancelled'), true);
    assert.equal(canTransitionOrder('confirmed', 'cancelled'), false);
    assert.equal(canTransitionOrder('cancelled', 'confirmed'), false);
    assert.throws(
        () => assertOrderTransition('confirmed', 'cancelled'),
        /Invalid order transition/,
    );
});

test('permission checks are case-insensitive', () => {
    assert.equal(hasAnyRole('Staff', ['staff']), true);
    assert.equal(hasAnyRole('organizer', ['Organizer']), true);
    assert.equal(hasAnyRole('Attendee', ['staff', 'admin']), false);
});

test('QR payload can be created, parsed and cryptographically verified', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const ticketId = 'ticket-123';
    const ticketSecret = 'ABCDEFGHIJKLMNOPQRST';
    const signature = signTicketIdentity(ticketId, ticketSecret, privateKey);
    const qrData = createTicketQrPayload({
        ticketId,
        ticketSecret,
        currentTotpCode: '123456',
        signature,
    });
    const parsed = parseTicketQrPayload(qrData);

    assert.ok(parsed);
    assert.equal(parsed.ticketId, ticketId);
    assert.equal(verifyTicketQrSignature(parsed, publicKey), true);
    assert.equal(verifyTicketQrSignature({ ...parsed, ticketId: 'tampered' }, publicKey), false);
    assert.equal(parseTicketQrPayload('missing|parts'), null);
});

test('show availability remains a deterministic pure calculation', () => {
    const now = new Date('2026-07-29T10:00:00.000Z');
    const availability = computeShowAvailability({
        status: 'published',
        sale_start: '2026-07-29T09:00:00.000Z',
        sale_end: '2026-07-29T11:00:00.000Z',
        start_time: '2026-07-30T10:00:00.000Z',
        end_time: '2026-07-30T12:00:00.000Z',
    }, now);

    assert.equal(availability.is_bookable, true);
    assert.equal(availability.booking_status, 'on_sale');
    assert.equal(availability.time_state, 'upcoming');
});

test('Redis infrastructure errors are classified separately from domain errors', () => {
    assert.equal(isRedisUnavailableError(new Error('The client is closed')), true);
    assert.equal(isRedisUnavailableError(new Error('connect ECONNREFUSED 127.0.0.1:6380')), true);
    assert.equal(isRedisUnavailableError(new Error('SEAT_UNAVAILABLE')), false);
});
