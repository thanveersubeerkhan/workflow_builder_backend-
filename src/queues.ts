import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
});

export const flowQueue = new Queue('flow-execution', { connection });
export const refreshQueue = new Queue('token-refresh', { connection });
export const triggerQueue = new Queue('trigger-polling', { connection });

export const redisConnection = connection;
