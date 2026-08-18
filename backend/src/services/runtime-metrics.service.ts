import { monitorEventLoopDelay } from 'node:perf_hooks';
import os from 'node:os';
import { getRedisAttributionMetrics } from './redis-attribution.service';

type RequestSample = {
    durationMs: number;
    statusCode: number;
};

type RouteMetrics = {
    requests: number;
    errors: number;
    conflicts: number;
    samples: RequestSample[];
};

type PhaseMetrics = {
    samples: number[];
};

const MAX_SAMPLES_PER_ROUTE = 2_000;
const routeMetrics = new Map<string, RouteMetrics>();
const loginPhaseMetrics = new Map<string, PhaseMetrics>();
const holdPhaseMetrics = new Map<string, PhaseMetrics>();
const startedAtMs = Date.now();
const startedCpu = process.cpuUsage();
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });

if (process.env.PERFORMANCE_DIAGNOSTICS_ENABLED === 'true') {
    eventLoopDelay.enable();
}

const percentile = (values: number[], percentileValue: number): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
    );
    return Number(sorted[index].toFixed(2));
};

export const runtimeMetricsEnabled = () => process.env.PERFORMANCE_DIAGNOSTICS_ENABLED === 'true';
export const loginPhaseMetricsEnabled = () => runtimeMetricsEnabled()
    && process.env.PERFORMANCE_AUTH_DIAGNOSTICS_ENABLED === 'true';
export const holdPhaseMetricsEnabled = () => runtimeMetricsEnabled()
    && process.env.PERFORMANCE_HOLD_DIAGNOSTICS_ENABLED === 'true';

export const recordRequestMetric = (method: string, path: string, durationMs: number, statusCode: number) => {
    if (!runtimeMetricsEnabled()) return;

    const key = `${method} ${path}`;
    const metric = routeMetrics.get(key) || {
        requests: 0,
        errors: 0,
        conflicts: 0,
        samples: [],
    };
    metric.requests += 1;
    if (statusCode >= 500) metric.errors += 1;
    if (statusCode === 409) metric.conflicts += 1;
    metric.samples.push({ durationMs, statusCode });
    if (metric.samples.length > MAX_SAMPLES_PER_ROUTE) metric.samples.shift();
    routeMetrics.set(key, metric);
};

// Benchmark-only diagnostic detail. Callers gate this before taking any timers,
// so normal authentication behavior and its hot-path overhead are unchanged.
export const recordLoginPhaseMetric = (phase: string, durationMs: number) => {
    if (!loginPhaseMetricsEnabled()) return;
    const metric = loginPhaseMetrics.get(phase) || { samples: [] };
    metric.samples.push(durationMs);
    if (metric.samples.length > MAX_SAMPLES_PER_ROUTE) metric.samples.shift();
    loginPhaseMetrics.set(phase, metric);
};

export const recordHoldPhaseMetric = (phase: string, durationMs: number) => {
    if (!holdPhaseMetricsEnabled()) return;
    const metric = holdPhaseMetrics.get(phase) || { samples: [] };
    metric.samples.push(durationMs);
    if (metric.samples.length > MAX_SAMPLES_PER_ROUTE) metric.samples.shift();
    holdPhaseMetrics.set(phase, metric);
};

export const getRuntimeMetrics = () => {
    const elapsedMs = Math.max(1, Date.now() - startedAtMs);
    const cpu = process.cpuUsage(startedCpu);
    const cpuMs = (cpu.user + cpu.system) / 1_000;
    const cores = Math.max(1, os.cpus().length);
    const routes = Array.from(routeMetrics.entries()).map(([route, metric]) => {
        const durations = metric.samples.map(sample => sample.durationMs);
        return {
            route,
            requests: metric.requests,
            serverErrors: metric.errors,
            businessConflicts: metric.conflicts,
            p50Ms: percentile(durations, 50),
            p95Ms: percentile(durations, 95),
            p99Ms: percentile(durations, 99),
            sampleCount: durations.length,
        };
    });
    const authLoginPhases = loginPhaseMetricsEnabled()
        ? Object.fromEntries(Array.from(loginPhaseMetrics.entries()).map(([phase, metric]) => [phase, {
            p50Ms: percentile(metric.samples, 50),
            p95Ms: percentile(metric.samples, 95),
            p99Ms: percentile(metric.samples, 99),
            sampleCount: metric.samples.length,
        }]))
        : null;
    const holdPhases = holdPhaseMetricsEnabled()
        ? Object.fromEntries(Array.from(holdPhaseMetrics.entries()).map(([phase, metric]) => [phase, {
            p50Ms: percentile(metric.samples, 50),
            p95Ms: percentile(metric.samples, 95),
            p99Ms: percentile(metric.samples, 99),
            sampleCount: metric.samples.length,
        }]))
        : null;

    return {
        startedAt: new Date(startedAtMs).toISOString(),
        uptimeSeconds: Number((elapsedMs / 1_000).toFixed(2)),
        process: {
            pid: process.pid,
            cpuUtilizationPercent: Number(((cpuMs / elapsedMs / cores) * 100).toFixed(2)),
            memory: process.memoryUsage(),
        },
        eventLoop: runtimeMetricsEnabled() ? {
            meanDelayMs: Number((eventLoopDelay.mean / 1e6).toFixed(2)),
            maxDelayMs: Number((eventLoopDelay.max / 1e6).toFixed(2)),
            p99DelayMs: Number((eventLoopDelay.percentile(99) / 1e6).toFixed(2)),
        } : null,
        routes,
        authLoginPhases,
        holdPhases,
        redisAttribution: getRedisAttributionMetrics(),
    };
};
