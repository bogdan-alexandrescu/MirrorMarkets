import { FastifyPluginAsync } from 'fastify';
import { createWithdrawalSchema, paginationSchema } from '@mirrormarkets/shared';
import { WalletService } from '../services/wallet.service.js';
import { AuditService } from '../services/audit.service.js';
import { getTradingAuthorityProvider } from '../adapters/trading-authority.factory.js';

export const fundRoutes: FastifyPluginAsync = async (app) => {
  const tradingAuthority = getTradingAuthorityProvider(app.prisma);
  const walletService = new WalletService(app.prisma, tradingAuthority);
  const audit = new AuditService(app.prisma);

  // GET /funds/deposit-address
  app.get('/deposit-address', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const proxyWallet = await app.prisma.wallet.findUnique({
      where: { userId_type: { userId: request.userId, type: 'POLY_PROXY' } },
    });

    if (!proxyWallet) {
      return reply.status(404).send({ message: 'Proxy wallet not provisioned' });
    }

    return reply.send({
      address: proxyWallet.address,
      chain: 'Polygon',
      token: 'USDC',
    });
  });

  // POST /funds/withdrawals
  app.post('/withdrawals', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { amount, destinationAddr } = createWithdrawalSchema.parse(request.body);

    const relayer = await walletService.getRelayerAdapter(request.userId);

    const withdrawal = await app.prisma.withdrawal.create({
      data: {
        userId: request.userId,
        amount,
        destinationAddr,
        status: 'PENDING',
      },
    });

    try {
      const amountRaw = BigInt(Math.floor(amount * 1e6)); // USDC has 6 decimals
      const txHash = await relayer.withdraw(amountRaw, destinationAddr);

      await app.prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: 'SUBMITTED', transactionHash: txHash },
      });

      await audit.log({
        userId: request.userId,
        action: 'WITHDRAWAL_INITIATED',
        details: { amount, destinationAddr, txHash },
        ipAddress: request.ip,
      });

      return reply.status(201).send({ ...withdrawal, status: 'SUBMITTED', transactionHash: txHash });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      await app.prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: 'FAILED', errorMessage: message },
      });

      throw error;
    }
  });

  // GET /funds/approval-status
  app.get('/approval-status', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const creds = await app.prisma.polymarketCredentials.findUnique({
      where: { userId: request.userId },
    });

    return reply.send({ approved: creds?.isProxyDeployed ?? false });
  });

  // POST /funds/approve-exchange
  app.post('/approve-exchange', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const relayer = await walletService.getRelayerAdapter(request.userId);

      const { ctfTxHash, negRiskTxHash } = await relayer.approveExchange();

      // Mark proxy as deployed (exchange approved)
      await app.prisma.polymarketCredentials.update({
        where: { userId: request.userId },
        data: { isProxyDeployed: true },
      });

      await audit.log({
        userId: request.userId,
        action: 'EXCHANGE_APPROVED',
        details: { ctfTxHash, negRiskTxHash },
        ipAddress: request.ip,
      });

      return reply.send({ approved: true, txHashes: [ctfTxHash, negRiskTxHash] });
    } catch (error) {
      request.log.error(error, 'approve-exchange failed');
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ code: 'APPROVE_FAILED', message });
    }
  });

  // GET /funds/withdrawals
  app.get('/withdrawals', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { page, pageSize } = paginationSchema.parse(request.query);

    const [items, total] = await Promise.all([
      app.prisma.withdrawal.findMany({
        where: { userId: request.userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      app.prisma.withdrawal.count({ where: { userId: request.userId } }),
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
