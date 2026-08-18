import { Rate, Trend } from 'k6/metrics';
import { admission, disjointSeatForIndex, hold, login, manifest, seatMap, userForVu } from './lib/flow.js';

const holdLatency = new Trend('hold_latency_ms', true);
const unexpectedFailures = new Rate('unexpected_failures');
const expectedConflicts = new Rate('expected_business_conflicts');
const contestedSeats = Number(__ENV.CONTESTED_SEATS || 5);

export const options = {
    scenarios: {
        seat_contention: {
            executor: 'per-vu-iterations',
            vus: Number(__ENV.VUS || 100),
            iterations: Number(__ENV.ITERATIONS || 1),
            maxDuration: __ENV.MAX_DURATION || '5m',
        },
    },
};

export default function () {
    const token = login(userForVu(__VU));
    if (!token) { unexpectedFailures.add(1); return; }
    const admitted = admission(manifest.booking.showId, token);
    const map = admitted.checkoutToken && seatMap(manifest.booking.showId, token, admitted.checkoutToken);
    if (!map || map.layout.status !== 200 || map.status.status !== 200) {
        unexpectedFailures.add(1); return;
    }
    const seatId = disjointSeatForIndex((__VU - 1) % contestedSeats);
    const response = hold(manifest.booking.showId, token, admitted.checkoutToken, seatId, manifest.booking.ticketTypeId);
    holdLatency.add(response.timings.duration);
    expectedConflicts.add(response.status === 409 ? 1 : 0);
    unexpectedFailures.add(response.status === 201 || response.status === 409 ? 0 : 1);
}
