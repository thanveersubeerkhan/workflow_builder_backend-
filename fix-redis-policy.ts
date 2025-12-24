import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

async function fixEvictionPolicy() {
    console.log('--- Attempting to fix Redis Eviction Policy ---');
    const redis = new Redis(redisUrl);
    
    try {
        const policy = await redis.config('GET', 'maxmemory-policy');
        console.log('Current Policy:', policy);

        await redis.config('SET', 'maxmemory-policy', 'noeviction');
        console.log('✅ Successfully set policy to noeviction');
    } catch (error: any) {
        console.error('❌ Could not set policy via code:', error.message);
        console.log('\n--- HOW TO FIX MANUALLY ---');
        console.log('1. Log in to your Redis Cloud Console (redislabs.com)');
        console.log('2. Select your Database');
        console.log('3. Go to "Configuration" or "Settings"');
        console.log('4. Find "Eviction Policy" and change it to "noeviction"');
        console.log('5. Save changes.');
    } finally {
        redis.disconnect();
    }
}

fixEvictionPolicy();
