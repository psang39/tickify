import 'dotenv/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const runId = process.argv[process.argv.indexOf('--run-id') + 1];
if (!runId || runId === '--run-id' || !/^[a-zA-Z0-9-]{3,40}$/.test(runId)) {
    throw new Error('Pass a safe --run-id.');
}
if (
    process.env.PERFORMANCE_QUEUE_ISOLATION !== 'true'
    || !/\/tickify_perf(?:_|$|\?)/.test(process.env.URI || '')
    || !/127\.0\.0\.1:6380\/2(?:$|\?)/.test(process.env.REDIS_URL || '')
) {
    throw new Error('Queue isolation proof requires local tickify_perf Mongo and Redis DB 2 with PERFORMANCE_QUEUE_ISOLATION=true.');
}

const queueName = (suffix: string) => `order-expiration-perf-${runId}-${suffix}`;

const main = async () => {
    const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    const queueA = new Queue(queueName('a'), { connection });
    const queueB = new Queue(queueName('b'), { connection });
    try {
        await queueA.obliterate({ force: true });
        await queueB.obliterate({ force: true });
        await queueA.add('proof-delayed-job', { proof: 'A-only' } as any, { delay: 60 * 60 * 1000 });
        const [aDelayed, bDelayed] = await Promise.all([
            queueA.getJobCounts('delayed'),
            queueB.getJobCounts('delayed'),
        ]);
        if (aDelayed.delayed !== 1 || bDelayed.delayed !== 0) {
            throw new Error(`Isolation failed: A delayed=${aDelayed.delayed}, B delayed=${bDelayed.delayed}`);
        }
        console.log(JSON.stringify({
            queueA: queueName('a'), delayedInA: aDelayed.delayed,
            queueB: queueName('b'), delayedInB: bDelayed.delayed,
            result: 'isolated',
        }, null, 2));
    } finally {
        await queueA.obliterate({ force: true });
        await queueB.obliterate({ force: true });
        await queueA.close();
        await queueB.close();
        await connection.quit();
    }
};

main().catch(error => { console.error(error); process.exitCode = 1; });
