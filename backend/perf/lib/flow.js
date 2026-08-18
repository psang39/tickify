import http from 'k6/http';
import { check } from 'k6';

export const apiBaseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:5000/api/v1').replace(/\/$/, '');
// `open()` resolves relative to this module, rather than the shell's working directory.
export const manifest = JSON.parse(open(__ENV.PERF_MANIFEST || '../generated/baseline.json'));

const json = (token, checkoutToken) => ({
    headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(checkoutToken ? { 'x-checkout-token': checkoutToken } : {}),
    },
    tags: { workload: 'booking' },
});

export function userForVu(vu) {
    return manifest.users[(vu - 1) % manifest.users.length];
}

export function preissuedTokenForVu(vu) {
    return userForVu(vu).preissuedToken || null;
}

// A single edge seat per row is valid under Tickify's no-orphan-seat rule.
// Using adjacent individual seats in one row would measure client-invalid selections,
// not uncontended booking capacity.
export function disjointSeatForIndex(index) {
    const seatsPerRow = Number(manifest.booking.seatsPerRow || __ENV.SEATS_PER_ROW || 20);
    return manifest.booking.seatIds[(index * seatsPerRow) % manifest.booking.seatIds.length];
}

export function disjointSeatForVu(vu) {
    return disjointSeatForIndex(vu - 1);
}

export function login(user) {
    const response = http.post(`${apiBaseUrl}/auth/login`, JSON.stringify({
        email: user.email,
        password: manifest.password,
    }), json());
    const valid = check(response, { 'login succeeds': r => r.status === 200 });
    if (!valid) return null;
    const body = response.json();
    return body?.token || body?.data?.token || null;
}

export function admission(showId, token) {
    const joined = http.post(`${apiBaseUrl}/shows/${showId}/waiting-room/join`, '{}', json(token));
    if (![200, 201].includes(joined.status)) return { checkoutToken: null, joinStatus: joined.status };

    const status = http.get(`${apiBaseUrl}/shows/${showId}/waiting-room/status`, json(token));
    if (status.status !== 200) return { checkoutToken: null, joinStatus: status.status };
    const body = status.json();
    return {
        checkoutToken: body?.checkoutToken || body?.data?.checkoutToken || null,
        state: body?.status || body?.data?.status || body?.state || body?.data?.state,
        joinStatus: status.status,
    };
}

export function seatMap(showId, token, checkoutToken) {
    // Mirrors the booking page's Promise.all: layout and dynamic status begin together.
    const [layout, status] = http.batch([
        ['GET', `${apiBaseUrl}/shows/${showId}/seat-map/layout`, null, json(token, checkoutToken)],
        ['GET', `${apiBaseUrl}/shows/${showId}/seat-map/status`, null, json(token, checkoutToken)],
    ]);
    return { layout, status };
}

export function hold(showId, token, checkoutToken, seatId, ticketTypeId) {
    return http.post(`${apiBaseUrl}/orders/hold`, JSON.stringify({
        show_id: showId,
        items: [{ seat_id: seatId, ticket_type_id: ticketTypeId }],
    }), json(token, checkoutToken));
}

export function orderId(response) {
    const body = response.json();
    return body?.data?.order_id || body?.order_id || null;
}

export function release(token, checkoutToken, id) {
    return http.post(`${apiBaseUrl}/orders/release`, JSON.stringify({ order_id: id }), json(token, checkoutToken));
}

export function paymentUrl(token, id, user) {
    return http.post(`${apiBaseUrl}/payments/create-url`, JSON.stringify({
        orderId: id,
        purchaserName: 'Performance User',
        purchaserPhone: '0900000000',
        purchaserEmail: user.email,
        paymentMethod: 'MOCK',
    }), json(token));
}
