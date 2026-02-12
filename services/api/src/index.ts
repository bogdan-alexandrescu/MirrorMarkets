import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { getConfig } from './config.js';
import { errorHandler } from './plugins/error-handler.js';
import { authPlugin } from './plugins/auth.js';
import { idempotencyPlugin } from './plugins/idempotency.js';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { authRoutes } from './routes/auth.js';
import { walletRoutes } from './routes/wallets.js';
import { leaderRoutes } from './routes/leaders.js';
import { userRoutes } from './routes/users.js';
import { followRoutes } from './routes/follows.js';
import { copyRoutes } from './routes/copy.js';
import { orderRoutes } from './routes/orders.js';
import { fillRoutes } from './routes/fills.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { fundRoutes } from './routes/funds.js';
import { claimRoutes } from './routes/claims.js';
import { systemRoutes } from './routes/system.js';
import { adminRoutes } from './routes/admin.js';

async function main() {
  const config = getConfig();

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Plugins
  await app.register(cors, {
    origin: config.WEB_URL,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
  });

  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(errorHandler);
  await app.register(authPlugin);
  await app.register(idempotencyPlugin);

  // Routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(walletRoutes, { prefix: '/wallets' });
  await app.register(leaderRoutes, { prefix: '/leaders' });
  await app.register(userRoutes, { prefix: '/users' });
  await app.register(followRoutes, { prefix: '/follows' });
  await app.register(copyRoutes, { prefix: '/copy' });
  await app.register(orderRoutes, { prefix: '/orders' });
  await app.register(fillRoutes, { prefix: '/fills' });
  await app.register(portfolioRoutes, { prefix: '/portfolio' });
  await app.register(fundRoutes, { prefix: '/funds' });
  await app.register(claimRoutes, { prefix: '/claims' });
  await app.register(systemRoutes, { prefix: '/system' });
  await app.register(adminRoutes, { prefix: '/admin' });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.listen({ port: config.API_PORT, host: config.API_HOST });
  app.log.info(`API server listening on ${config.API_HOST}:${config.API_PORT}`);
}

main().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
