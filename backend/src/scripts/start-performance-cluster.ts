import cluster from 'node:cluster';
import { watch } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const apiProcesses = Number(process.env.PERFORMANCE_API_PROCESSES || '1');

if (!Number.isInteger(apiProcesses) || apiProcesses < 1 || apiProcesses > 4) {
    throw new Error('PERFORMANCE_API_PROCESSES must be an integer from 1 to 4.');
}

if (process.env.NODE_ENV !== 'performance' || process.env.PERFORMANCE_QUEUE_ISOLATION !== 'true') {
    throw new Error('The cluster launcher is restricted to NODE_ENV=performance with queue isolation enabled.');
}

if (cluster.isPrimary) {
    console.log(`[performance-cluster] Starting ${apiProcesses} API worker(s).`);
    for (let index = 0; index < apiProcesses; index += 1) {
        cluster.fork({
            ...process.env,
            PERFORMANCE_API_ONLY: 'true',
        });
    }

    const metricsFile = process.env.PERFORMANCE_CLUSTER_METRICS_FILE;
    const metricsRequestFile = process.env.PERFORMANCE_CLUSTER_METRICS_REQUEST_FILE;
    const permittedResultsDirectory = path.resolve(process.cwd(), 'perf', 'results');

    for (const candidate of [metricsFile, metricsRequestFile]) {
        if (candidate && !path.resolve(candidate).startsWith(`${permittedResultsDirectory}${path.sep}`)) {
            throw new Error('Cluster metrics files must be inside backend/perf/results.');
        }
    }

    const collectWorkerMetrics = async () => {
        if (!metricsFile) return;

        const workers = Object.values(cluster.workers ?? {}).filter((worker): worker is cluster.Worker => Boolean(worker));
        const requestId = `${process.pid}-${Date.now()}`;
        const snapshots: unknown[] = [];

        await new Promise<void>(resolve => {
            let remaining = workers.length;
            const timeout = setTimeout(resolve, 2_000);
            const onMessage = (message: any) => {
                if (message?.type !== 'performance-cluster-metrics' || message.requestId !== requestId) return;
                snapshots.push(message.metrics);
                remaining -= 1;
                if (remaining === 0) {
                    clearTimeout(timeout);
                    resolve();
                }
            };
            workers.forEach(worker => {
                worker.on('message', onMessage);
                worker.send({ type: 'performance-cluster-metrics-request', requestId });
            });
            if (remaining === 0) {
                clearTimeout(timeout);
                resolve();
            }
        });

        await writeFile(metricsFile, `${JSON.stringify({
            capturedAt: new Date().toISOString(),
            expectedWorkers: workers.length,
            snapshots,
        }, null, 2)}\n`);
    };

    const shutdown = () => {
        void collectWorkerMetrics().finally(() => {
            cluster.disconnect(() => process.exit(0));
        });
    };

    // A one-shot post-run marker avoids polling or IPC traffic during k6. The
    // harness writes it only after the timed workload, then reads the snapshot
    // before terminating this primary and its API-worker process tree.
    if (metricsFile && metricsRequestFile) {
        const requestDirectory = path.dirname(path.resolve(metricsRequestFile));
        const requestName = path.basename(metricsRequestFile);
        const watcher = watch(requestDirectory, (_event, filename) => {
            if (String(filename) !== requestName) return;
            watcher.close();
            void collectWorkerMetrics();
        });
    }
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
} else {
    // The worker runs the unchanged HTTP bootstrap. Queue consumption is kept
    // in one dedicated benchmark process so cluster size does not change it.
    const { getRuntimeMetrics } = require('../services/runtime-metrics.service') as typeof import('../services/runtime-metrics.service');
    process.on('message', (message: any) => {
        if (message?.type !== 'performance-cluster-metrics-request') return;
        process.send?.({
            type: 'performance-cluster-metrics',
            requestId: message.requestId,
            metrics: getRuntimeMetrics(),
        });
    });
    require('../server');
}
