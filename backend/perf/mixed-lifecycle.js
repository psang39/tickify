import crypto from 'k6/crypto';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { admission, apiBaseUrl, disjointSeatForVu, hold, login, manifest, orderId, paymentUrl, release, seatMap, userForVu } from './lib/flow.js';

const unexpectedFailures = new Rate('unexpected_failures');
const holdLatency = new Trend('hold_latency_ms', true);
const completedPayments = new Rate('completed_payments');
const completedReleases = new Rate('completed_releases');
const submittedAbandons = new Rate('submitted_abandons');
const paymentSecret = __ENV.MOCK_PAYMENT_SECRET;

export const options = {
    scenarios: {
        mixed_lifecycle: {
            executor: 'per-vu-iterations',
            vus: Number(__ENV.VUS || 60),
            iterations: Number(__ENV.ITERATIONS || 1),
            maxDuration: __ENV.MAX_DURATION || '10m',
        },
    },
};

export default function () {
    const user = userForVu(__VU);
    const token = login(user);
    if (!token) { unexpectedFailures.add(1); return; }
    const admitted = admission(manifest.booking.showId, token);
    const map = admitted.checkoutToken && seatMap(manifest.booking.showId, token, admitted.checkoutToken);
    if (!map || map.layout.status !== 200 || map.status.status !== 200) {
        unexpectedFailures.add(1); return;
    }
    const response = hold(manifest.booking.showId, token, admitted.checkoutToken,
        disjointSeatForVu(__VU), manifest.booking.ticketTypeId);
    holdLatency.add(response.timings.duration);
    if (response.status !== 201) { unexpectedFailures.add(1); return; }
    const id = orderId(response);
    const path = (__VU - 1) % 3;
    if (path === 0) {
        if (!paymentSecret || paymentUrl(token, id, user).status !== 200) { unexpectedFailures.add(1); return; }
        const amount = 100000;
        const transactionId = `perf-${manifest.runId}-${__VU}-${Date.now()}`;
        const signed = `order_id=${id}&amount=${amount}&status=SUCCESS&transactionId=${transactionId}`;
        const signature = crypto.hmac('sha256', paymentSecret, signed, 'hex');
        const payment = http.post(`${apiBaseUrl}/webhooks/payment-result`, JSON.stringify({
            order_id: id, amount, status: 'SUCCESS', transaction_id: transactionId, signature,
        }), { headers: { 'Content-Type': 'application/json' }, tags: { workload: 'payment_callback' } });
        completedPayments.add(payment.status === 200 ? 1 : 0);
        unexpectedFailures.add(payment.status === 200 ? 0 : 1);
    } else if (path === 1) {
        const released = release(token, admitted.checkoutToken, id);
        completedReleases.add(released.status === 200 ? 1 : 0);
        unexpectedFailures.add(released.status === 200 ? 0 : 1);
    } else {
        submittedAbandons.add(1);
    }
}
