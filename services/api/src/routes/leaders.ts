import { FastifyPluginAsync } from 'fastify';
import { PolymarketAdapter } from '../adapters/polymarket.adapter.js';
import { paginationSchema, AppError, ErrorCodes } from '@mirrormarkets/shared';

export const leaderRoutes: FastifyPluginAsync = async (app) => {
  // GET /leaders/leaderboard
  app.get('/leaderboard', async (request, reply) => {
    const leaders = await PolymarketAdapter.fetchLeaderboard();

    // Sync leaders to local DB
    for (const leader of leaders) {
      await app.prisma.leader.upsert({
        where: { address: leader.address },
        create: {
          address: leader.address,
          displayName: leader.displayName,
          profileImageUrl: leader.profileImageUrl,
          pnl: leader.pnl,
          volume: leader.volume,
          rank: leader.rank,
          lastSyncedAt: new Date(),
        },
        update: {
          displayName: leader.displayName,
          profileImageUrl: leader.profileImageUrl,
          pnl: leader.pnl,
          volume: leader.volume,
          rank: leader.rank,
          lastSyncedAt: new Date(),
        },
      });
    }

    const dbLeaders = await app.prisma.leader.findMany({
      orderBy: { rank: 'asc' },
      take: 50,
    });

    return reply.send(dbLeaders);
  });

  // GET /leaders/:leaderId
  app.get('/:leaderId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { leaderId } = request.params as { leaderId: string };

    const leader = await app.prisma.leader.findUnique({
      where: { id: leaderId },
    });

    if (!leader) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Leader not found', 404);
    }

    return reply.send(leader);
  });

  // GET /leaders/:leaderId/events
  app.get('/:leaderId/events', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { leaderId } = request.params as { leaderId: string };
    const { page, pageSize } = paginationSchema.parse(request.query);

    const leader = await app.prisma.leader.findUnique({
      where: { id: leaderId },
    });

    if (!leader) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Leader not found', 404);
    }

    const [items, total] = await Promise.all([
      app.prisma.leaderEvent.findMany({
        where: { leaderId },
        orderBy: { detectedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      app.prisma.leaderEvent.count({ where: { leaderId } }),
    ]);

    return reply.send({
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  });
};
