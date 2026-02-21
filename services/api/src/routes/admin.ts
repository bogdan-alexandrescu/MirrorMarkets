import { FastifyPluginAsync } from 'fastify';
import { retryRelayerSchema, NotFoundError } from '@mirrormarkets/shared';
import { getTradingAuthorityProvider } from '../adapters/trading-authority.factory.js';
import { AuditService } from '../services/audit.service.js';
import { ProvisioningService } from '../services/provisioning.service.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // POST /admin/reconcile
  app.post('/reconcile', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, string>;
    const maxAgeMs = parseInt(query.maxAgeMs ?? '') || 24 * 60 * 60 * 1000;

    const openOrders = await app.prisma.order.findMany({
      where: { status: 'OPEN' },
      include: { user: { select: { id: true } } },
    });

    let reconciled = 0;
    const staleThreshold = new Date(Date.now() - maxAgeMs);

    for (const order of openOrders) {
      // Expire orders that are stale or were never placed on the exchange
      if (order.createdAt < staleThreshold || !order.polyOrderId) {
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

  // POST /admin/migrate-wallets
  // Migrates all existing Crossmint server wallets to Dynamic.xyz.
  // Deletes old ServerWallet + CLOB credentials, then runs full provisioning
  // to create Dynamic wallet and derive new CLOB credentials.
  app.post('/migrate-wallets', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const tradingAuthority = getTradingAuthorityProvider(app.prisma);
    const audit = new AuditService(app.prisma);
    const provisioning = new ProvisioningService(app.prisma, audit, tradingAuthority);

    const serverWallets = await app.prisma.serverWallet.findMany({
      where: { status: 'READY' },
    });

    const results: Array<{
      userId: string;
      oldAddress: string;
      newAddress: string | null;
      clobCredentials: boolean;
      error: string | null;
    }> = [];

    for (const sw of serverWallets) {
      try {
        const oldAddress = sw.address;

        // 1. Delete old CLOB credentials (bound to old wallet address)
        await app.prisma.polymarketCredentials.deleteMany({ where: { userId: sw.userId } });

        // 2. Delete old ServerWallet record (so provisioning creates a new one)
        await app.prisma.serverWallet.delete({ where: { id: sw.id } });

        // 3. Run full provisioning (creates Dynamic wallet + derives CLOB creds)
        const status = await provisioning.provision(sw.userId);

        // 4. Get the new address
        const newSw = await app.prisma.serverWallet.findUnique({ where: { userId: sw.userId } });

        results.push({
          userId: sw.userId,
          oldAddress,
          newAddress: newSw?.address ?? null,
          clobCredentials: status.clobCredentials,
          error: null,
        });
      } catch (err) {
        results.push({
          userId: sw.userId,
          oldAddress: sw.address,
          newAddress: null,
          clobCredentials: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const migrated = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    return reply.send({
      total: serverWallets.length,
      migrated,
      failed,
      results,
    });
  });
};
