import { AsyncLocalStorage } from 'node:async_hooks';
import { channel } from 'node:diagnostics_channel';
import { performance } from 'node:perf_hooks';

type RedisCommandContext = {
    replyAtMs?: number;
    socketWriteAtMs?: number;
};

type RedisCommandSample = {
    wallMs: number;
    submitToSocketWriteMs: number | null;
    socketWriteToParsedReplyMs: number | null;
    replyToPromiseResumeMs: number | null;
    inFlightAtSubmit: number;
};

type RedisCommandMetrics = {
    inFlight: number;
    maxInFlight: number;
    samples: RedisCommandSample[];
};

const MAX_SAMPLES = 2_000;
const commandMetrics = new Map<string, RedisCommandMetrics>();
const redisCommandContext = new AsyncLocalStorage<RedisCommandContext>();
const pendingSocketWrites = new Set<RedisCommandContext>();
const attributionEnabledAtStartup = process.env.PERFORMANCE_DIAGNOSTICS_ENABLED === 'true'
    && process.env.PERFORMANCE_REDIS_ATTRIBUTION_ENABLED === 'true';
let socketWritesObserved = 0;

// node-redis emits this after it has parsed a command reply but before the
// caller's awaited promise continuation can run. It is an opt-in, benchmark
// diagnostic channel provided by node-redis itself.
if (attributionEnabledAtStartup) {
    channel('node-redis:command:reply').subscribe(() => {
        const context = redisCommandContext.getStore();
        if (context) context.replyAtMs = performance.now();
    });

    // node-redis has no public per-command write event. Its internal
    // RedisSocket.write() is the closest stable point immediately before it
    // loops over the queued RESP chunks and calls the underlying net.Socket.
    // This benchmark-only interception applies only to node-redis (not the
    // ioredis BullMQ/SSE clients); Tickify has one node-redis request client.
    const redisSocketModule = require('@redis/client/dist/lib/client/socket') as {
        default: {
            prototype: {
        write: (...args: unknown[]) => boolean;
            };
        };
    };
    const redisSocketPrototype = redisSocketModule.default.prototype;
    const originalRedisSocketWrite = redisSocketPrototype.write;
    redisSocketPrototype.write = function benchmarkRedisSocketWrite(...args: unknown[]): boolean {
        if (pendingSocketWrites.size > 0) {
            const writtenAt = performance.now();
            for (const context of pendingSocketWrites) context.socketWriteAtMs = writtenAt;
            pendingSocketWrites.clear();
            socketWritesObserved += 1;
        }
        return originalRedisSocketWrite.apply(this, args);
    };
}

export const redisAttributionEnabled = () => attributionEnabledAtStartup;

export const measureRedisCommandAttribution = async <T>(
    command: string,
    operation: () => Promise<T>,
): Promise<T> => {
    if (!redisAttributionEnabled()) return operation();

    const metric = commandMetrics.get(command) || {
        inFlight: 0,
        maxInFlight: 0,
        samples: [],
    };
    commandMetrics.set(command, metric);

    const inFlightAtSubmit = metric.inFlight;
    metric.inFlight += 1;
    metric.maxInFlight = Math.max(metric.maxInFlight, metric.inFlight);
    const startedAt = performance.now();
    const context: RedisCommandContext = {};
    pendingSocketWrites.add(context);

    try {
        return await redisCommandContext.run(context, operation);
    } finally {
        const finishedAt = performance.now();
        metric.inFlight -= 1;
        pendingSocketWrites.delete(context);
        metric.samples.push({
            wallMs: finishedAt - startedAt,
            submitToSocketWriteMs: context.socketWriteAtMs === undefined
                ? null
                : Math.max(0, context.socketWriteAtMs - startedAt),
            socketWriteToParsedReplyMs: context.socketWriteAtMs === undefined || context.replyAtMs === undefined
                ? null
                : Math.max(0, context.replyAtMs - context.socketWriteAtMs),
            replyToPromiseResumeMs: context.replyAtMs === undefined
                ? null
                : Math.max(0, finishedAt - context.replyAtMs),
            inFlightAtSubmit,
        });
        if (metric.samples.length > MAX_SAMPLES) metric.samples.shift();
    }
};

const percentile = (values: number[], percentileValue: number): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
    return Number(sorted[index].toFixed(2));
};

export const getRedisAttributionMetrics = () => {
    if (!redisAttributionEnabled()) return null;

    return {
        socketWriteBoundary: {
            socketWritesObserved,
        },
        commands: Object.fromEntries(Array.from(commandMetrics.entries()).map(([command, metric]) => [
            command,
            {
            sampleCount: metric.samples.length,
            inFlightNow: metric.inFlight,
            maxInFlight: metric.maxInFlight,
            wallMs: {
                p50: percentile(metric.samples.map(sample => sample.wallMs), 50),
                p95: percentile(metric.samples.map(sample => sample.wallMs), 95),
                p99: percentile(metric.samples.map(sample => sample.wallMs), 99),
            },
            submitToSocketWriteMs: {
                observedSamples: metric.samples.filter(sample => sample.submitToSocketWriteMs !== null).length,
                p50: percentile(metric.samples.flatMap(sample => sample.submitToSocketWriteMs ?? []), 50),
                p95: percentile(metric.samples.flatMap(sample => sample.submitToSocketWriteMs ?? []), 95),
                p99: percentile(metric.samples.flatMap(sample => sample.submitToSocketWriteMs ?? []), 99),
            },
            socketWriteToParsedReplyMs: {
                observedSamples: metric.samples.filter(sample => sample.socketWriteToParsedReplyMs !== null).length,
                p50: percentile(metric.samples.flatMap(sample => sample.socketWriteToParsedReplyMs ?? []), 50),
                p95: percentile(metric.samples.flatMap(sample => sample.socketWriteToParsedReplyMs ?? []), 95),
                p99: percentile(metric.samples.flatMap(sample => sample.socketWriteToParsedReplyMs ?? []), 99),
            },
            replyToPromiseResumeMs: {
                observedSamples: metric.samples.filter(sample => sample.replyToPromiseResumeMs !== null).length,
                p50: percentile(metric.samples.flatMap(sample => sample.replyToPromiseResumeMs ?? []), 50),
                p95: percentile(metric.samples.flatMap(sample => sample.replyToPromiseResumeMs ?? []), 95),
                p99: percentile(metric.samples.flatMap(sample => sample.replyToPromiseResumeMs ?? []), 99),
            },
            inFlightAtSubmit: {
                p50: percentile(metric.samples.map(sample => sample.inFlightAtSubmit), 50),
                p95: percentile(metric.samples.map(sample => sample.inFlightAtSubmit), 95),
                p99: percentile(metric.samples.map(sample => sample.inFlightAtSubmit), 99),
            },
            },
        ])),
    };
};
