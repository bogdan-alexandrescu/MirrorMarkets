import { FastifyPluginAsync } from 'fastify';
import { PolymarketAdapter } from '../adapters/polymarket.adapter.js';

export const leaderRoutes: FastifyPluginAsync = async (app) => {
  // GET /leaders/leaderboard
  app.get('/leaderboard', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const leaders = await PolymarketAdapter.fetchLeaderboard();

    // Sync leaders to local DB
    for (const leader of leaders) {
      await app.prisma.leader.upsert({
        where: { address: leader.address?.toLowerCase() ?? leader.userAddress?.toLowerCase() },
        create: {
          address: leader.address?.toLowerCase() ?? leader.userAddress?.toLowerCase(),
          displayName: leader.displayName ?? leader.username ?? null,
          profileImageUrl: leader.profileImage ?? null,
          pnl: leader.pnl ?? 0,
          volume: leader.volume ?? 0,
          rank: leader.rank ?? null,
          lastSyncedAt: new Date(),
        },
        update: {
          displayName: leader.displayName ?? leader.username ?? null,
          profileImageUrl: leader.profileImage ?? null,
          pnl: leader.pnl ?? 0,
          volume: leader.volume ?? 0,
          rank: leader.rank ?? null,
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
};
