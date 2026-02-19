import { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { WORKER_INTERVALS, POLYMARKET_CONTRACTS } from '@mirrormarkets/shared';

// Native USDC on Polygon (Circle-issued)
const NATIVE_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
// ERC-20 balanceOf(address) selector
const BALANCE_OF_SELECTOR = '0x70a08231';
// Redis TTL for cached USDC balance (10 minutes)
const USDC_BALANCE_TTL = 600;

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

    // Cache on-chain USDC balance in Redis for copy engine
    try {
      const balance = await this.getOnChainUsdcBalance(proxyAddress);
      await this.redis.set(`user:${userId}:usdc_balance`, balance.toString(), 'EX', USDC_BALANCE_TTL);
    } catch (error) {
      this.logger.warn({ userId, err: error }, 'Failed to cache USDC balance');
    }
  }

  private async getOnChainUsdcBalance(walletAddress: string): Promise<number> {
    const rpcUrl = process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com';
    const paddedAddr = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const callData = `${BALANCE_OF_SELECTOR}${paddedAddr}`;

    const callContract = async (contractAddr: string): Promise<bigint> => {
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{ to: contractAddr, data: callData }, 'latest'],
            id: 1,
          }),
        });
        const data = (await res.json()) as { result?: string };
        return data.result ? BigInt(data.result) : 0n;
      } catch {
        return 0n;
      }
    };

    const [usdcE, native] = await Promise.all([
      callContract(POLYMARKET_CONTRACTS.USDC),
      callContract(NATIVE_USDC),
    ]);

    // Both have 6 decimals
    return Number(usdcE + native) / 1e6;
  }
}
