import { Rate, Trend } from 'k6/metrics';
import { admission, disjointSeatForIndex, hold, login, manifest, orderId, release, seatMap, userForVu } from './lib/flow.js';

const holdLatency = new Trend('hold_latency_ms', true);
const unexpectedFailures = new Rate('unexpected_failures');

export const options = {
    scenarios: {
        soak: {
            executor: 'constant-vus',
            vus: Number(__ENV.VUS || 25),
            duration: __ENV.DURATION || '30m',
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
    const response = hold(manifest.booking.showId, token, admitted.checkoutToken, disjointSeatForIndex(__VU - 1), manifest.booking.ticketTypeId);
    holdLatency.add(response.timings.duration);
    if (response.status !== 201) { unexpectedFailures.add(1); return; }
    const released = release(token, admitted.checkoutToken, orderId(response));
    unexpectedFailures.add(released.status === 200 ? 0 : 1);
}
