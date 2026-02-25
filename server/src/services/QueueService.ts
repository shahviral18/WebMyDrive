/**
 * QueueService — gracefully degrades if Redis is unavailable.
 * All queue.add() calls become no-ops when Redis is offline.
 */

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// ── Probe Redis availability synchronously via require ────────────────────────
let Queue: any = null;
let Worker: any = null;
let redisAvailable = false;

try {
    const bullmq = require('bullmq');
    Queue = bullmq.Queue;
    Worker = bullmq.Worker;
    redisAvailable = true;
} catch {
    redisAvailable = false;
}

const connection = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    // Stop retrying after 1 attempt so we don't flood logs
    retryStrategy: () => null,
};

// ── Stub queue that does nothing when Redis is unavailable ────────────────────
class NullQueue {
    name: string;
    constructor(name: string) { this.name = name; }
    async add(_jobName: string, _data: any) { /* no-op */ }
    on(_event: string, _handler: any) { return this; }
}

function makeQueue(name: string) {
    if (!redisAvailable || !Queue) return new NullQueue(name) as any;
    try {
        const q = new Queue(name, { connection });
        // Absorb connection errors — do NOT let them propagate
        q.on('error', (_err: any) => { /* suppressed */ });
        return q;
    } catch {
        return new NullQueue(name) as any;
    }
}

export const CreateUserQueue = makeQueue('CreateUserQueue');
export const UpdateUserQueue = makeQueue('UpdateUserQueue');
export const SuspendUserQueue = makeQueue('SuspendUserQueue');
export const SyncQueue = makeQueue('SyncQueue');

export const createWorker = (queueName: string, processor: (job: any) => Promise<any>) => {
    if (!redisAvailable || !Worker) return null;
    try {
        const worker = new Worker(queueName, processor, { connection });
        worker.on('error', (_err: any) => { /* suppressed */ });
        worker.on('completed', (job: any) => console.log(`[Worker:${queueName}] Job ${job.id} completed`));
        worker.on('failed', (job: any, err: any) => console.error(`[Worker:${queueName}] Job ${job?.id} failed: ${err.message}`));
        return worker;
    } catch {
        return null;
    }
};
