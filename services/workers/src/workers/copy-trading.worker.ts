import { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { TradingAuthorityProvider } from '@mirrormarkets/shared';
import { WORKER_INTERVALS } from '@mirrormarkets/shared';
import { CopyEngine } from '../engine/copy-engine.js';

export class CopyTradingWorker {
  private engine: CopyEngine;
  private copyInterval: ReturnType<typeof setInterval> | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger,
    tradingAuthority: TradingAuthorityProvider,
  ) {
    this.engine = new CopyEngine(prisma, logger, tradingAuthority);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    const intervalMs = parseInt(process.env.LEADER_SYNC_INTERVAL_MS ?? '') || WORKER_INTERVALS.LEADER_SYNC_MS;

    this.logger.info({ intervalMs }, 'Copy trading worker started');

    this.copyInterval = setInterval(() => this.poll(), intervalMs);
    this.syncInterval = setInterval(() => this.syncAllLeaderTrades(), intervalMs);

    // Run immediately
    this.poll();
    this.syncAllLeaderTrades();
  }

  stop(): void {
    this.running = false;
    if (this.copyInterval) {
      clearInterval(this.copyInterval);
      this.copyInterval = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.logger.info('Copy trading worker stopped');
  }

  /**
   * 15s poll — copy trading for users with copy ENABLED.
   * If a LeaderEvent already exists (synced by the 60s loop), skip creation
   * but still trigger copy execution.
   */
  private async poll(): Promise<void> {
    try {
      await this.redis.set('worker:copy-trading:last-ping', Date.now().toString());

      // Get all active leaders being followed by users with copy enabled
      const activeFollows = await this.prisma.follow.findMany({
        where: {
          status: 'ACTIVE',
          user: {
            copyProfile: {
              status: 'ENABLED',
            },
          },
        },
        select: {
          leader: {
            select: {
              id: true,
              address: true,
              lastSyncedAt: true,
            },
          },
        },
        distinct: ['leaderId'],
      });

      const leaders = activeFollows.map((f) => f.leader);

      for (const leader of leaders) {
        try {
          await this.pollLeaderTrades(leader);
        } catch (error) {
          this.logger.error({ leaderId: leader.id, err: error }, 'Failed to poll leader trades');
        }
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Copy trading poll error');
    }
  }

  private async pollLeaderTrades(leader: { id: string; address: string; lastSyncedAt: Date | null }): Promise<void> {
    const trades = await this.fetchPolymarketTrades(leader.address);
    if (!trades || trades.length === 0) return;

    const lastSync = leader.lastSyncedAt ? leader.lastSyncedAt.getTime() : 0;

    for (const trade of trades) {
      const parsed = this.parseTrade(trade);
      if (parsed.tradeTime <= lastSync) continue;

      // Check if already synced by the 60s loop
      const existing = await this.prisma.leaderEvent.findFirst({
        where: {
          leaderId: leader.id,
          transactionHash: parsed.transactionHash,
        },
      });

      if (existing) {
        // Event already exists — just trigger copy execution
        await this.engine.processCopiesForEvent(existing);
        continue;
      }

      await this.engine.processLeaderEvent({
        leaderId: leader.id,
        ...parsed.fields,
      });
    }

    // Update last synced timestamp
    await this.prisma.leader.update({
      where: { id: leader.id },
      data: { lastSyncedAt: new Date() },
    });
  }

  /**
   * 60s loop — sync trades for ALL leaders with at least one active follower
   * (regardless of copy trading status). Stores LeaderEvent records and SyncLog entries.
   */
  private async syncAllLeaderTrades(): Promise<void> {
    try {
      // Find ALL leaders with at least one ACTIVE follow
      const activeFollows = await this.prisma.follow.findMany({
        where: { status: 'ACTIVE' },
        select: {
          leader: {
            select: { id: true, address: true, displayName: true, lastSyncedAt: true },
          },
        },
        distinct: ['leaderId'],
      });

      const leaders = activeFollows.map((f) => f.leader);

      await this.prisma.syncLog.create({
        data: {
          message: `Sync started: checking ${leaders.length} followed leader(s)`,
          level: 'info',
          leaderAddress: '*',
        },
      });

      for (const leader of leaders) {
        try {
          const count = await this.syncLeaderFromPolymarket(leader);
          const label = leader.displayName ?? leader.address.slice(0, 10);
          await this.prisma.syncLog.create({
            data: {
              leaderAddress: leader.address,
              leaderName: leader.displayName,
              tradesFound: count,
              message: count > 0
                ? `Found ${count} new trade(s) for ${label}`
                : `No new trades for ${label}`,
              level: 'info',
            },
          });
        } catch (error) {
          const label = leader.displayName ?? leader.address.slice(0, 10);
          await this.prisma.syncLog.create({
            data: {
              leaderAddress: leader.address,
              leaderName: leader.displayName,
              tradesFound: 0,
              message: `Error syncing ${label}: ${error instanceof Error ? error.message : 'unknown'}`,
              level: 'error',
            },
          });
        }
      }

      await this.prisma.syncLog.create({
        data: {
          message: `Sync complete. Next run in ${WORKER_INTERVALS.LEADER_SYNC_MS / 1000}s.`,
          level: 'info',
          leaderAddress: '*',
        },
      });
    } catch (error) {
      this.logger.error({ err: error }, 'Leader sync error');
    }
  }

  /**
   * Fetch trades from Polymarket and store new ones as LeaderEvent records.
   * Returns the count of new trades found.
   */
  private async syncLeaderFromPolymarket(leader: {
    id: string;
    address: string;
    displayName: string | null;
    lastSyncedAt: Date | null;
  }): Promise<number> {
    const trades = await this.fetchPolymarketTrades(leader.address);
    if (!trades || trades.length === 0) return 0;

    const lastSync = leader.lastSyncedAt ? leader.lastSyncedAt.getTime() : 0;
    let newCount = 0;

    for (const trade of trades) {
      const parsed = this.parseTrade(trade);
      if (parsed.tradeTime <= lastSync) continue;

      // Deduplicate by transactionHash
      if (parsed.transactionHash) {
        const existing = await this.prisma.leaderEvent.findFirst({
          where: { leaderId: leader.id, transactionHash: parsed.transactionHash },
        });
        if (existing) continue;
      }

      await this.prisma.leaderEvent.create({
        data: {
          leaderId: leader.id,
          ...parsed.fields,
        },
      });
      newCount++;
    }

    // Update last synced timestamp
    await this.prisma.leader.update({
      where: { id: leader.id },
      data: { lastSyncedAt: new Date() },
    });

    return newCount;
  }

  /**
   * Normalize a Polymarket data API trade object into our internal format.
   * The API returns: asset (token ID), slug (market slug), timestamp (unix seconds),
   * conditionId, transactionHash, side, size, price.
   */
  private parseTrade(trade: any): {
    tradeTime: number;
    transactionHash: string | undefined;
    fields: {
      conditionId: string;
      tokenId: string;
      marketSlug: string | undefined;
      side: 'BUY' | 'SELL';
      size: number;
      price: number;
      transactionHash: string | undefined;
    };
  } {
    // timestamp is unix seconds from the Polymarket data API
    const ts = trade.timestamp;
    const tradeTime = typeof ts === 'number' && ts > 1e12 ? ts : (typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime());

    const transactionHash = trade.transactionHash ?? trade.tx_hash;

    return {
      tradeTime,
      transactionHash,
      fields: {
        conditionId: trade.conditionId ?? trade.condition_id,
        tokenId: trade.asset ?? trade.tokenId ?? trade.asset_id,
        marketSlug: trade.slug ?? trade.marketSlug ?? trade.market_slug,
        side: trade.side === 'BUY' || trade.side === 0 ? 'BUY' : 'SELL',
        size: parseFloat(trade.size ?? trade.amount ?? '0'),
        price: parseFloat(trade.price ?? '0'),
        transactionHash,
      },
    };
  }

  private async fetchPolymarketTrades(address: string): Promise<any[] | null> {
    const res = await fetch(
      `https://data-api.polymarket.com/trades?maker=${address}&limit=20`,
    );

    if (!res.ok) {
      this.logger.warn({ address, status: res.status }, 'Failed to fetch leader trades');
      return null;
    }

    const trades = await res.json();
    if (!Array.isArray(trades) || trades.length === 0) return null;
    return trades;
  }
}
