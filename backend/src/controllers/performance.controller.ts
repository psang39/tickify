import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { performance } from 'node:perf_hooks';
import redisClient from '../utils/redisClient';
import OutboxEvent from '../models/outbox-event.model';
import { orderExpirationQueue } from '../queues/orderExpiration.queue';
import { getRuntimeMetrics, runtimeMetricsEnabled } from '../services/runtime-metrics.service';

const timed = async <T>(operation: () => Promise<T>) => {
    const startedAt = performance.now();
    try {
        const value = await operation();
        return { ok: true, latencyMs: Number((performance.now() - startedAt).toFixed(2)), value };
    } catch (error) {
        return { ok: false, latencyMs: Number((performance.now() - startedAt).toFixed(2)), error: String(error) };
    }
};

const parseRedisInfo = (raw: string, names: string[]) => Object.fromEntries(
    names.map(name => {
        const match = raw.match(new RegExp(`^${name}:(.+)$`, 'm'));
        return [name, match?.[1] || null];
    }),
);

const commandStat = (raw: string, command: string) => {
    const match = raw.match(new RegExp(`^cmdstat_${command}:([^\\r\\n]+)$`, 'm'));
    return match?.[1] || null;
};

export const getPerformanceDiagnostics = async (_req: Request, res: Response): Promise<void> => {
    if (!runtimeMetricsEnabled()) {
        res.status(404).json({ message: 'Performance diagnostics are disabled.' });
        return;
    }

    const [redis, mongo, queue, outbox] = await Promise.all([
        timed(async () => {
            const [ping, stats, commandstats, clients, cpu, slowlogLength, slowlog, latencyLatest, latencyThreshold] = await Promise.all([
                redisClient.ping(),
                redisClient.sendCommand(['INFO', 'stats']),
                redisClient.sendCommand(['INFO', 'commandstats']),
                redisClient.sendCommand(['INFO', 'clients']),
                redisClient.sendCommand(['INFO', 'cpu']),
                redisClient.sendCommand(['SLOWLOG', 'LEN']),
                redisClient.sendCommand(['SLOWLOG', 'GET', '32']),
                redisClient.sendCommand(['LATENCY', 'LATEST']),
                redisClient.sendCommand(['CONFIG', 'GET', 'latency-monitor-threshold']),
            ]);
            return {
                ping,
                stats: parseRedisInfo(String(stats), [
                    'total_commands_processed',
                    'instantaneous_ops_per_sec',
                    'total_error_replies',
                    'keyspace_hits',
                    'keyspace_misses',
                ]),
                clients: parseRedisInfo(String(clients), [
                    'connected_clients',
                    'blocked_clients',
                    'tracking_clients',
                    'maxclients',
                ]),
                cpu: parseRedisInfo(String(cpu), [
                    'used_cpu_sys',
                    'used_cpu_user',
                    'used_cpu_sys_main_thread',
                    'used_cpu_user_main_thread',
                ]),
                commandstats: {
                    eval: commandStat(String(commandstats), 'eval'),
                    evalsha: commandStat(String(commandstats), 'evalsha'),
                    get: commandStat(String(commandstats), 'get'),
                    ping: commandStat(String(commandstats), 'ping'),
                },
                slowlog: {
                    length: Number(slowlogLength),
                    latest: slowlog,
                },
                latency: {
                    monitorThreshold: latencyThreshold,
                    latest: latencyLatest,
                },
            };
        }),
        timed(async () => {
            const database = mongoose.connection.db;
            if (!database) throw new Error('MongoDB is not connected');
            const serverStatus: any = await database.admin().command({ serverStatus: 1 });
            return {
                transactions: serverStatus.transactions ? {
                    currentActive: serverStatus.transactions.currentActive,
                    currentInactive: serverStatus.transactions.currentInactive,
                    totalCommitted: serverStatus.transactions.totalCommitted,
                    totalAborted: serverStatus.transactions.totalAborted,
                } : null,
                opcounters: serverStatus.opcounters || null,
            };
        }),
        timed(async () => {
            const [counts, oldestDelayed] = await Promise.all([
                orderExpirationQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
                orderExpirationQueue.getDelayed(0, 0),
            ]);
            const first = oldestDelayed[0];
            const dueAt = first ? first.timestamp + (first.opts.delay || 0) : null;
            return {
                counts,
                oldestDelayedJobLagMs: dueAt === null ? null : Math.max(0, Date.now() - dueAt),
            };
        }),
        timed(async () => {
            const oldest = await OutboxEvent.findOne({ status: { $in: ['pending', 'publishing', 'failed'] } })
                .sort({ createdAt: 1 })
                .select('status createdAt locked_at next_attempt_at')
                .lean() as any;
            return {
                oldestUnpublished: oldest || null,
                oldestUnpublishedAgeMs: oldest ? Math.max(0, Date.now() - new Date(oldest.createdAt).getTime()) : null,
            };
        }),
    ]);

    res.status(200).json({
        runtime: getRuntimeMetrics(),
        dependencies: { redis, mongo, expirationQueue: queue, outbox },
    });
};
