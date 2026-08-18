import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from 'redis';

const readOption = (name: string, fallback: string): string => {
    const index = process.argv.indexOf(name);
    return index === -1 ? fallback : process.argv[index + 1] || fallback;
};

const durationMs = Number(readOption('--duration-ms', '15000'));
const intervalMs = Number(readOption('--interval-ms', '250'));
const output = readOption('--output', 'perf/results/redis-samples.json');

if (
    process.env.PERFORMANCE_QUEUE_ISOLATION !== 'true'
    || !/^redis:\/\/127\.0\.0\.1:6380\/2(?:$|\?)/.test(process.env.REDIS_URL || '')
) {
    throw new Error('Redis performance sampling is restricted to the isolated local performance Redis URL (127.0.0.1:6380/2).');
}

const parseInfo = (raw: string, fields: string[]) => Object.fromEntries(fields.map(field => {
    const match = raw.match(new RegExp(`^${field}:(.+)$`, 'm'));
    return [field, match?.[1] || null];
}));

const commandStats = (raw: string, command: string) => {
    const match = raw.match(new RegExp(`^cmdstat_${command}:([^\\r\\n]+)$`, 'm'));
    return match?.[1] || null;
};

const summarizeClientList = (raw: string) => {
    const entries = raw.split(/\r?\n/).filter(Boolean).map(line => Object.fromEntries(
        line.split(' ').map(pair => pair.split('=', 2)).filter(pair => pair.length === 2),
    ));
    return {
        total: entries.length,
        blocked: entries.filter(client => client.flags?.includes('b')).length,
        pubsub: entries.filter(client => client.flags?.includes('P')).length,
        database0: entries.filter(client => client.db === '0').length,
        database2: entries.filter(client => client.db === '2').length,
        maxOutputBufferBytes: Math.max(0, ...entries.map(client => Number(client.obl || 0))),
        maxQueryBufferBytes: Math.max(0, ...entries.map(client => Number(client.qbuf || 0))),
    };
};

const client = createClient({ url: process.env.REDIS_URL });
client.on('error', error => console.error('[redis sampler]', error.message));

const sample = async () => {
    const [stats, commands, clients, cpu, slowlogLength, latencyLatest] = await Promise.all([
        client.sendCommand(['INFO', 'stats']),
        client.sendCommand(['INFO', 'commandstats']),
        client.sendCommand(['CLIENT', 'LIST']),
        client.sendCommand(['INFO', 'cpu']),
        client.sendCommand(['SLOWLOG', 'LEN']),
        client.sendCommand(['LATENCY', 'LATEST']),
    ]);
    return {
        at: new Date().toISOString(),
        stats: parseInfo(String(stats), [
            'total_commands_processed', 'instantaneous_ops_per_sec', 'total_error_replies',
        ]),
        clients: summarizeClientList(String(clients)),
        cpu: parseInfo(String(cpu), [
            'used_cpu_sys', 'used_cpu_user', 'used_cpu_sys_main_thread', 'used_cpu_user_main_thread',
        ]),
        commandstats: {
            eval: commandStats(String(commands), 'eval'),
            evalsha: commandStats(String(commands), 'evalsha'),
            get: commandStats(String(commands), 'get'),
            ping: commandStats(String(commands), 'ping'),
        },
        slowlogLength: Number(slowlogLength),
        latencyLatest,
    };
};

const main = async () => {
    await client.connect();
    const initialSlowlog = await client.sendCommand(['SLOWLOG', 'GET', '128']);
    const samples: unknown[] = [];
    const deadline = Date.now() + durationMs;

    while (Date.now() < deadline) {
        samples.push(await sample());
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    const finalSlowlog = await client.sendCommand(['SLOWLOG', 'GET', '128']);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify({
        startedAt: new Date(Date.now() - durationMs).toISOString(),
        durationMs,
        intervalMs,
        samples,
        initialSlowlog,
        finalSlowlog,
    }, null, 2)}\n`);
    await client.quit();
};

main().catch(async error => {
    console.error(error);
    if (client.isOpen) await client.quit();
    process.exitCode = 1;
});
