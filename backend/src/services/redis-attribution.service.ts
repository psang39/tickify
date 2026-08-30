import { AsyncLocalStorage } from 'node:async_hooks';
import { channel } from 'node:diagnostics_channel';
import { Socket } from 'node:net';
import { performance } from 'node:perf_hooks';

type RedisCommandContext = {
    replyDataArrivalAtMs?: number;
    replyAtMs?: number;
    socketWriteAtMs?: number;
};

type RedisCommandSample = {
    wallMs: number;
    submitToSocketWriteMs: number | null;
    socketWriteToReplyDataArrivalMs: number | null;
    replyDataArrivalToParsedReplyMs: number | null;
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
let replyDataEventsObserved = 0;
let redisSocketConnectDepth = 0;
let mostRecentReplyDataArrivalAtMs: number | undefined;
const nodeRedisSockets = new WeakSet<Socket>();

// node-redis emits this after it has parsed a command reply but before the
// caller's awaited promise continuation can run. It is an opt-in, benchmark
// diagnostic channel provided by node-redis itself.
if (attributionEnabledAtStartup) {
    channel('node-redis:command:reply').subscribe(() => {
        const context = redisCommandContext.getStore();
        if (context) {
            context.replyAtMs = performance.now();
            if (mostRecentReplyDataArrivalAtMs !== undefined) {
                context.replyDataArrivalAtMs = mostRecentReplyDataArrivalAtMs;
            }
        }
    });

    // node-redis has no public per-command write event. Its internal
    // RedisSocket.write() is the closest stable point immediately before it
    // loops over the queued RESP chunks and calls the underlying net.Socket.
    // This benchmark-only interception applies only to node-redis (not the
    // ioredis BullMQ/SSE clients); Tickify has one node-redis request client.
    const redisSocketModule = require('@redis/client/dist/lib/client/socket') as {
        default: {
            prototype: {
                connect: (...args: unknown[]) => Promise<void>;
                write: (...args: unknown[]) => boolean;
            };
        };
    };
    const redisSocketPrototype = redisSocketModule.default.prototype;
    const originalRedisSocketConnect = redisSocketPrototype.connect;
    redisSocketPrototype.connect = function benchmarkRedisSocketConnect(...args: unknown[]): Promise<void> {
        // RedisSocket.connect() creates its net.Socket synchronously before
        // awaiting connection readiness. This short scope tags only sockets
        // created by node-redis, never the ioredis BullMQ/SSE connections.
        redisSocketConnectDepth += 1;
        try {
            return originalRedisSocketConnect.apply(this, args);
        } finally {
            redisSocketConnectDepth -= 1;
        }
    };

    // Use CommonJS require here: TypeScript's namespace-import helper creates
    // a copied facade for node:net, whereas node-redis retains the real module
    // object that its createConnection call resolves from.
    const netModule = require('node:net') as {
        createConnection: (...args: unknown[]) => Socket;
    };
    const originalCreateConnection = netModule.createConnection;
    netModule.createConnection = function benchmarkRedisCreateConnection(...args: unknown[]): Socket {
        const socket = originalCreateConnection.apply(this, args);
        if (redisSocketConnectDepth > 0) nodeRedisSockets.add(socket);
        return socket;
    };

    const socketPrototype = Socket.prototype as unknown as {
        emit: (event: string | symbol, ...args: unknown[]) => boolean;
    };
    const originalSocketEmit = socketPrototype.emit;
    socketPrototype.emit = function benchmarkRedisSocketEmit(
        this: Socket,
        event: string | symbol,
        ...args: unknown[]
    ): boolean {
        if (event !== 'data' || !nodeRedisSockets.has(this)) {
            return originalSocketEmit.call(this, event, ...args);
        }

        // This runs before node-redis's registered data listener invokes the
        // RESP decoder. node-redis publishes a command reply after its internal
        // await resumes, so retain the most recent tagged data-arrival time for
        // that command-reply microtask rather than clearing it on return.
        mostRecentReplyDataArrivalAtMs = performance.now();
        replyDataEventsObserved += 1;
        return originalSocketEmit.call(this, event, ...args);
    };

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
            socketWriteToReplyDataArrivalMs: context.socketWriteAtMs === undefined || context.replyDataArrivalAtMs === undefined
                ? null
                : Math.max(0, context.replyDataArrivalAtMs - context.socketWriteAtMs),
            replyDataArrivalToParsedReplyMs: context.replyDataArrivalAtMs === undefined || context.replyAtMs === undefined
                ? null
                : Math.max(0, context.replyAtMs - context.replyDataArrivalAtMs),
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
            replyDataEventsObserved,
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
            socketWriteToReplyDataArrivalMs: {
                observedSamples: metric.samples.filter(sample => sample.socketWriteToReplyDataArrivalMs !== null).length,
                p50: percentile(metric.samples.flatMap(sample => sample.socketWriteToReplyDataArrivalMs ?? []), 50),
                p95: percentile(metric.samples.flatMap(sample => sample.socketWriteToReplyDataArrivalMs ?? []), 95),
                p99: percentile(metric.samples.flatMap(sample => sample.socketWriteToReplyDataArrivalMs ?? []), 99),
            },
            replyDataArrivalToParsedReplyMs: {
                observedSamples: metric.samples.filter(sample => sample.replyDataArrivalToParsedReplyMs !== null).length,
                p50: percentile(metric.samples.flatMap(sample => sample.replyDataArrivalToParsedReplyMs ?? []), 50),
                p95: percentile(metric.samples.flatMap(sample => sample.replyDataArrivalToParsedReplyMs ?? []), 95),
                p99: percentile(metric.samples.flatMap(sample => sample.replyDataArrivalToParsedReplyMs ?? []), 99),
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
