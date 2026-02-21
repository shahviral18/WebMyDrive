/**
 * QueueService — gracefully degrades if Redis is unavailable.
 * In development without Redis, all queue.add() calls become no-ops.
 */

let Queue: any, Worker: any, QueueEvents: any;
let redisAvailable = false;

try {
    const bullmq = require('bullmq');
    Queue = bullmq.Queue;
    Worker = bullmq.Worker;
    QueueEvents = bullmq.QueueEvents;
    redisAvailable = true;
} catch {
    redisAvailable = false;
}

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
};

// Stub queue that does nothing if Redis is unavailable
class NullQueue {
    name: string;
    constructor(name: string) { this.name = name; }
    async add(jobName: string, data: any) {
        console.warn(`[Queue:${this.name}] Redis unavailable — job '${jobName}' skipped. Data:`, data);
    }
}

function makeQueue(name: string) {
    if (!redisAvailable) return new NullQueue(name) as any;
    try {
        return new Queue(name, { connection });
    } catch {
        console.warn(`[Queue] Could not create queue '${name}' — Redis may be offline.`);
        return new NullQueue(name) as any;
    }
}

export const CreateUserQueue = makeQueue('CreateUserQueue');
export const UpdateUserQueue = makeQueue('UpdateUserQueue');
export const SuspendUserQueue = makeQueue('SuspendUserQueue');
export const SyncQueue = makeQueue('SyncQueue');

export const createWorker = (queueName: string, processor: (job: any) => Promise<any>) => {
    if (!redisAvailable || !Worker) {
        console.warn(`[Worker] Redis unavailable — worker for '${queueName}' not started.`);
        return null;
    }
    try {
        const worker = new Worker(queueName, processor, { connection });
        worker.on('completed', (job: any) => console.log(`[Worker:${queueName}] Job ${job.id} completed`));
        worker.on('failed', (job: any, err: any) => console.error(`[Worker:${queueName}] Job ${job?.id} failed: ${err.message}`));
        return worker;
    } catch {
        console.warn(`[Worker] Could not start worker for '${queueName}'.`);
        return null;
    }
};
