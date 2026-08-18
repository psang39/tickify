import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { apiBaseUrl, manifest, userForVu } from './lib/flow.js';

const loginLatency = new Trend('login_latency_ms', true);
const unexpectedFailures = new Rate('unexpected_failures');

export const options = {
    scenarios: {
        login_decomposition: {
            executor: 'per-vu-iterations',
            vus: Number(__ENV.VUS || 50),
            iterations: Number(__ENV.ITERATIONS || 1),
            maxDuration: __ENV.MAX_DURATION || '5m',
        },
    },
};

export default function () {
    const user = userForVu(__VU);
    const response = http.post(`${apiBaseUrl}/auth/login`, JSON.stringify({
        email: user.email,
        password: manifest.password,
    }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { workload: 'login-decomposition' },
    });
    loginLatency.add(response.timings.duration);
    const valid = check(response, { 'login succeeds': value => value.status === 200 });
    unexpectedFailures.add(valid ? 0 : 1);
}
