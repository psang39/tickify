import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { createClient } from 'redis';
import {
    getRedisAttributionMetrics,
    measureRedisCommandAttribution,
} from '../services/redis-attribution.service';
import { holdSeatsLuaScript } from '../services/booking/reservation-redis.service';

const option = (name: string, fallback: string) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? fallback : process.argv[index + 1] || fallback;
};

const concurrency = Number(option('--concurrency', '25'));
const output = option('--output', `perf/results/redis-only-${concurrency}.json`);
const runId = process.env.PERFORMANCE_RUN_ID || '';
const redisUrl = process.env.REDIS_URL || '';

if (
    !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 1_000
    || process.env.PERFORMANCE_QUEUE_ISOLATION !== 'true'
    || !/^[a-zA-Z0-9-]{3,48}$/.test(runId)
    || !/^redis:\/\/127\.0\.0\.1:6380\/2(?:$|\?)/.test(redisUrl)
) {
    throw new Error('Redis-only control requires a bounded concurrency, local performance Redis DB 2, and a PERFORMANCE_RUN_ID.');
}

const percentile = (values: number[], p: number) => {
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return Number(sorted[index].toFixed(2));
};

const summarize = (samples: number[]) => ({
    p50Ms: percentile(samples, 50),
    p95Ms: percentile(samples, 95),
    p99Ms: percentile(samples, 99),
    maxMs: Number(Math.max(...samples).toFixed(2)),
});

// This deliberately mirrors the production request client: one node-redis
// connection configured entirely through REDIS_URL.
const client = createClient({ url: redisUrl });
client.on('error', error => console.error('[redis-only control]', error.message));

const namespace = `perf:redis-attribution:${runId}`;
const rows = Array.from({ length: concurrency }, (_, index) => `${namespace}:row:${index}`);
const users = Array.from({ length: concurrency }, (_, index) => `${namespace}:user:${index}:held_count`);
const locks = Array.from({ length: concurrency }, (_, index) => `${namespace}:seat:${index}:lock`);
const keysToCleanup = [...rows, ...users, ...locks];

let active = 0;
let maxActive = 0;
const inFlightAtSubmit: number[] = [];

const runBurst = async (operation: (index: number) => Promise<unknown>) => {
    active = 0;
    maxActive = 0;
    inFlightAtSubmit.length = 0;
    let releaseGate!: () => void;
    const gate = new Promise<void>(resolve => { releaseGate = resolve; });
    const operations = Array.from({ length: concurrency }, async (_, index) => {
        await gate;
        const inFlight = active;
        active += 1;
        maxActive = Math.max(maxActive, active);
        inFlightAtSubmit.push(inFlight);
        const startedAt = performance.now();
        try {
            await operation(index);
            return performance.now() - startedAt;
        } finally {
            active -= 1;
        }
    });
    releaseGate();
    const latencies = await Promise.all(operations);
    return {
        latency: summarize(latencies),
        maxInFlight: maxActive,
        inFlightAtSubmit: summarize(inFlightAtSubmit),
    };
};

const main = async () => {
    const eventLoop = monitorEventLoopDelay({ resolution: 20 });
    eventLoop.enable();
    await client.connect();
    try {
        const setup = client.multi();
        rows.forEach(row => setup.set(row, 'OOO'));
        await setup.exec();

        const evalResult = await runBurst(index => measureRedisCommandAttribution('hold-eval', () => client.eval(holdSeatsLuaScript, {
            keys: [rows[index], users[index], locks[index]],
            arguments: ['600', `control-user-${index}`, '1'],
        })));
        const redisAttribution = getRedisAttributionMetrics();
        const rowValuesAfterEval = await client.mGet(rows);
        if (rowValuesAfterEval.some(row => row !== 'HOO')) {
            throw new Error(`Unexpected control EVAL result: ${JSON.stringify(rowValuesAfterEval.slice(0, 5))}`);
        }

        const getResult = await runBurst(index => client.get(rows[index]));
        const pingResult = await runBurst(() => client.ping());

        await mkdir(path.dirname(output), { recursive: true });
        await writeFile(output, `${JSON.stringify({
            runId,
            concurrency,
            topology: 'one node-redis client; REDIS_URL database; direct EVAL only',
            eval: evalResult,
            redisAttribution,
            get: getResult,
            ping: pingResult,
            eventLoop: {
                p99DelayMs: Number((eventLoop.percentile(99) / 1e6).toFixed(2)),
                maxDelayMs: Number((eventLoop.max / 1e6).toFixed(2)),
            },
        }, null, 2)}\n`);
    } finally {
        eventLoop.disable();
        await client.sendCommand(['DEL', ...keysToCleanup]);
        await client.quit();
    }
};

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
