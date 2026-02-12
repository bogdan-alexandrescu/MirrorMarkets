import { Queue } from 'bullmq';
import type Redis from 'ioredis';

export function createQueues(redis: Redis) {
  const connection = redis;

  return {
    copyTrading: new Queue('copy-trading', { connection }),
    autoClaim: new Queue('auto-claim', { connection }),
    healthCheck: new Queue('health-check', { connection }),
    positionSync: new Queue('position-sync', { connection }),
  };
}

export type Queues = ReturnType<typeof createQueues>;
