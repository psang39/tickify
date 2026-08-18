import { Rate, Trend } from 'k6/metrics';
import { admission, disjointSeatForVu, hold, login, manifest, orderId, seatMap, userForVu } from './lib/flow.js';

const holdLatency = new Trend('hold_latency_ms', true);
const unexpectedFailures = new Rate('unexpected_failures');
const expectedConflicts = new Rate('expected_business_conflicts');

export const options = {
    scenarios: {
        booking_baseline: {
            executor: 'per-vu-iterations',
            vus: Number(__ENV.VUS || 50),
            iterations: Number(__ENV.ITERATIONS || 1),
            maxDuration: __ENV.MAX_DURATION || '5m',
        },
    },
};

export default function () {
    const user = userForVu(__VU);
    const token = login(user);
    if (!token) { unexpectedFailures.add(1); return; }
    const admitted = admission(manifest.booking.showId, token);
    if (!admitted.checkoutToken) { unexpectedFailures.add(1); return; }
    const map = seatMap(manifest.booking.showId, token, admitted.checkoutToken);
    if (map.layout.status !== 200 || map.status.status !== 200) { unexpectedFailures.add(1); return; }
    const seatId = disjointSeatForVu(__VU);
    const response = hold(manifest.booking.showId, token, admitted.checkoutToken, seatId, manifest.booking.ticketTypeId);
    holdLatency.add(response.timings.duration);
    expectedConflicts.add(response.status === 409 ? 1 : 0);
    unexpectedFailures.add(response.status === 201 || response.status === 409 ? 0 : 1);
    if (response.status === 201 && !orderId(response)) unexpectedFailures.add(1);
}
