import { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { WORKER_INTERVALS } from '@mirrormarkets/shared';

export class PositionSyncWorker {
  private interval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    const pollMs = parseInt(process.env.POSITION_SYNC_INTERVAL_MS ?? '') || WORKER_INTERVALS.POSITION_SYNC_MS;

    this.logger.info({ pollMs }, 'Position sync worker started');

    this.interval = setInterval(() => this.sync(), pollMs);
  }

  stop(): void {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.logger.info('Position sync worker stopped');
  }

  private async sync(): Promise<void> {
    try {
      await this.redis.set('worker:position-sync:last-ping', Date.now().toString());

      // Get all users with proxy wallets
      const proxyWallets = await this.prisma.wallet.findMany({
        where: { type: 'POLY_PROXY' },
        select: { userId: true, address: true },
      });

      for (const proxy of proxyWallets) {
        try {
          await this.syncUserPositions(proxy.userId, proxy.address);
        } catch (error) {
          this.logger.error(
            { userId: proxy.userId, err: error },
            'Position sync failed for user',
          );
        }
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Position sync poll error');
    }
  }

  private async syncUserPositions(userId: string, proxyAddress: string): Promise<void> {
    // Fetch positions from Polymarket data API
    const res = await fetch(
      `https://data-api.polymarket.com/positions?address=${proxyAddress}`,
    );

    if (!res.ok) return;

    const positions = await res.json();
    if (!Array.isArray(positions)) return;

    for (const pos of positions) {
      await this.prisma.positionSnapshot.create({
        data: {
          userId,
          conditionId: pos.conditionId ?? pos.condition_id,
          tokenId: pos.tokenId ?? pos.asset_id,
          marketSlug: pos.marketSlug ?? pos.market_slug ?? null,
          size: parseFloat(pos.size ?? pos.amount ?? '0'),
          avgPrice: parseFloat(pos.avgPrice ?? pos.avg_price ?? '0'),
          currentPrice: parseFloat(pos.currentPrice ?? pos.cur_price ?? '0'),
          pnl: parseFloat(pos.pnl ?? '0'),
        },
      });
    }
  }
}
