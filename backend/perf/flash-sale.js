import http from 'k6/http';
import { sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { admission, apiBaseUrl, login, manifest, userForVu } from './lib/flow.js';

const queueStatusLatency = new Trend('queue_status_latency_ms', true);
const admissionLatency = new Trend('admission_latency_ms', true);
const failedIterations = new Rate('failed_iterations');

export const options = {
    scenarios: {
        flash_sale: {
            executor: 'per-vu-iterations',
            vus: Number(__ENV.VUS || 300),
            iterations: Number(__ENV.ITERATIONS || 1),
            maxDuration: __ENV.MAX_DURATION || '10m',
        },
    },
};

export default function () {
    const token = login(userForVu(__VU));
    if (!token) { failedIterations.add(1); return; }
    const headers = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, tags: { workload: 'flash_sale' } };
    const joined = http.post(`${apiBaseUrl}/shows/${manifest.flashSale.showId}/waiting-room/join`, '{}', headers);
    queueStatusLatency.add(joined.timings.duration);
    if (![200, 201].includes(joined.status)) { failedIterations.add(1); return; }

    const untilSaleMs = Date.parse(manifest.flashSale.startsAt) - Date.now();
    if (untilSaleMs > 0) {
        // k6's executor keeps this controlled: all users join before the seeded sale opens.
        sleep(untilSaleMs / 1000 + Number(__ENV.POST_OPEN_DELAY_SECONDS || 1));
    }
    const startedAt = Date.now();
    const admitted = admission(manifest.flashSale.showId, token);
    admissionLatency.add(Date.now() - startedAt);
    failedIterations.add(admitted.joinStatus === 200 && !['YOUR_TURN', 'WAITING'].includes(admitted.state) ? 1 : 0);
}
