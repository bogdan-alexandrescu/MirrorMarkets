import { FastifyPluginAsync } from 'fastify';
import { paginationSchema } from '@mirrormarkets/shared';

export const syncRoutes: FastifyPluginAsync = async (app) => {
  // GET /sync/logs — paginated sync log history
  app.get('/logs', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, pageSize } = paginationSchema.parse(request.query);

    const [items, total] = await Promise.all([
      app.prisma.syncLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      app.prisma.syncLog.count(),
    ]);

    return reply.send({
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  });

  // GET /sync/logs/stream — SSE endpoint for live sync logs
  app.get('/logs/stream', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let lastId = '';
    const interval = setInterval(async () => {
      try {
        const where: any = {};
        if (lastId) {
          where.id = { gt: lastId };
        }

        const logs = await app.prisma.syncLog.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          take: 20,
        });

        for (const log of logs) {
          const event = {
            type: 'sync_log' as const,
            data: {
              id: log.id,
              message: log.message,
              level: log.level,
              leaderAddress: log.leaderAddress,
              leaderName: log.leaderName,
              tradesFound: log.tradesFound,
            },
            timestamp: log.createdAt.toISOString(),
          };
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
          lastId = log.id;
        }
      } catch {
        // Connection may be closed
      }
    }, 2000);

    request.raw.on('close', () => {
      clearInterval(interval);
    });
  });
};
