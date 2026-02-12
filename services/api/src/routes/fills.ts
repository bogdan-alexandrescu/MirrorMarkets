import { FastifyPluginAsync } from 'fastify';
import { paginationSchema } from '@mirrormarkets/shared';

export const fillRoutes: FastifyPluginAsync = async (app) => {
  // GET /fills
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, pageSize } = paginationSchema.parse(request.query);

    const [items, total] = await Promise.all([
      app.prisma.fill.findMany({
        where: { order: { userId: request.userId } },
        include: { order: { select: { conditionId: true, tokenId: true, marketSlug: true } } },
        orderBy: { filledAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      app.prisma.fill.count({ where: { order: { userId: request.userId } } }),
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
