import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Detect if we are in a serverless environment
export const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTIONS_EMULATOR);

// Setup Redis Connection Options
const redisOptions: any = {
    // If on Vercel, fail fast. If on a worker, retry up to 10 times.
    maxRetriesPerRequest: isServerless ? 1 : 10, 
    enableReadyCheck: !isServerless,
    connectTimeout: 15000, // 15 seconds (good for ngrok latency)
    retryStrategy(times: number) {
        if (isServerless) return null; // Don't retry on Vercel
        return Math.min(times * 500, 2000); // Backoff for local worker
    }
};

// Auto-enable TLS for cloud providers (rediss://)
if (redisUrl.startsWith('rediss://')) {
    redisOptions.tls = {
        rejectUnauthorized: false
    };
}

// Detect if we are in a serverless environment
// (Moved to top)

let redisClient: Redis | null = null;

/**
 * Returns a shared Redis connection.
 * In serverless, we reuse this if the instance stays warm.
 */
export function getRedisClient(): Redis {
    if (!redisClient) {
        console.log(`[Redis] Opening new connection (Serverless: ${isServerless})`);
        redisClient = new Redis(redisUrl, redisOptions);
        
        redisClient.on('error', (err: any) => {
            console.error('[Redis] Connection Error:', err.message);
        });
    }
    return redisClient;
}

/**
 * Gracefully closes Redis connection.
 */
export async function closeRedisConnection() {
    if (redisClient) {
        console.log('[Redis] Disconnecting...');
        await redisClient.quit().catch(() => {});
        redisClient = null;
    }
}

// Export a default instance for convenience
export const redis = getRedisClient();
