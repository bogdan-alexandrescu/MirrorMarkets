import { FastifyPluginAsync } from 'fastify';
import { retryRelayerSchema, NotFoundError } from '@mirrormarkets/shared';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // POST /admin/reconcile
  app.post('/reconcile', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    // Trigger reconciliation of all open orders
    const openOrders = await app.prisma.order.findMany({
      where: { status: 'OPEN' },
      include: { user: { select: { id: true } } },
    });

    let reconciled = 0;
    for (const order of openOrders) {
      // In production, check order status against Polymarket CLOB
      // For now, mark stale orders as expired
      const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (order.createdAt < staleThreshold) {
        await app.prisma.order.update({
          where: { id: order.id },
          data: { status: 'EXPIRED' },
        });
        reconciled++;
      }
    }

    return reply.send({ reconciled, total: openOrders.length });
  });

  // POST /admin/retry-relayer
  app.post('/retry-relayer', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { txId } = retryRelayerSchema.parse(request.body);

    const tx = await app.prisma.relayerTx.findUnique({
      where: { id: txId },
    });

    if (!tx) throw new NotFoundError('RelayerTx');

    if (tx.status !== 'FAILED') {
      return reply.status(400).send({ message: 'Can only retry failed transactions' });
    }

    // Mark as pending for worker to retry
    await app.prisma.relayerTx.update({
      where: { id: txId },
      data: { status: 'PENDING', errorMessage: null },
    });

    return reply.send({ ok: true, txId });
  });
};
