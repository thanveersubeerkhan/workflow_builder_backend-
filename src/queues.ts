import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Setup Redis Connection Options
const redisOptions: any = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
};

// Auto-enable TLS for cloud providers (rediss://)
if (redisUrl.startsWith('rediss://')) {
    redisOptions.tls = {
        rejectUnauthorized: false // Often needed for various cloud providers
    };
}

const connection = new Redis(redisUrl, redisOptions);

export const flowQueue = new Queue('flow-execution', { connection });
export const refreshQueue = new Queue('token-refresh', { connection });
export const triggerQueue = new Queue('trigger-polling', { connection });

export const redisConnection = connection;
