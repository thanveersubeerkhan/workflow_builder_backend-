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

// Singleton instances to manage connection lifecycle
let sharedClient: Redis | null = null;
const workerClients: Redis[] = [];

// Detect if we are in a serverless environment (where workers shouldn't stay resident)
export const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTIONS_EMULATOR);

/**
 * Returns a shared Redis connection for Queues and general use.
 */
export function getSharedConnection(): Redis {
    if (!sharedClient) {
        console.log(`[Redis] Opening new shared connection (Serverless: ${isServerless})`);
        sharedClient = new Redis(redisUrl, redisOptions);
        sharedClient.on('error', (err: any) => {
            if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
                console.warn('[Redis] Shared connection reset, attempting to recover...');
            } else {
                console.error('[Redis] Shared Connection Error:', err);
            }
        });
    }
    return sharedClient;
}

/**
 * Creates and tracks a dedicated Redis connection for a BullMQ Worker.
 */
export function createWorkerConnection(): Redis | null {
    if (isServerless) {
        console.warn('[Redis] In serverless environment. Skipping dedicated worker connection.');
        return null;
    }

    console.log(`[Redis] Opening dedicated worker connection. Total worker connections: ${workerClients.length + 1}`);
    const client = new Redis(redisUrl, redisOptions);
    workerClients.push(client);
    
    client.on('error', (err: any) => {
        console.error('[Redis] Dedicated Worker Connection Error:', err);
    });

    return client;
}

/**
 * Gracefully closes all Redis connections.
 */
export async function closeRedisConnections() {
    console.log('[Redis] Disconnecting all clients...');
    if (sharedClient) {
        await sharedClient.quit().catch(() => {});
        sharedClient = null;
    }
    await Promise.all(workerClients.map(c => c.quit().catch(() => {})));
    workerClients.length = 0;
}

// Standard connection for Queues
export const flowQueue = new Queue('flow-execution', { 
    connection: getSharedConnection(),
    skipVersionCheck: true
});
export const refreshQueue = new Queue('token-refresh', { 
    connection: getSharedConnection(),
    skipVersionCheck: true
});
export const triggerQueue = new Queue('trigger-polling', { 
    connection: getSharedConnection(),
    skipVersionCheck: true
});

export const redisConnection = getSharedConnection();
