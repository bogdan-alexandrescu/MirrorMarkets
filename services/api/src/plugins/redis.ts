import Redis from 'ioredis';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getConfig } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPluginImpl: FastifyPluginAsync = async (app) => {
  const config = getConfig();
  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
  });

  redis.on('error', (err) => {
    app.log.error({ err }, 'Redis connection error');
  });

  app.log.info('Connected to Redis');

  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
  });
};

export const redisPlugin = fp(redisPluginImpl, { name: 'redis' });
