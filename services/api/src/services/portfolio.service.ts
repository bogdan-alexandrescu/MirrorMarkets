import { PrismaClient } from '@prisma/client';
import type { PositionInfo } from '@mirrormarkets/shared';
import { getConfig } from '../config.js';

export class PortfolioService {
  constructor(private prisma: PrismaClient) {}

  async getPositions(userId: string): Promise<PositionInfo[]> {
    const snapshots = await this.prisma.positionSnapshot.findMany({
      where: { userId },
      orderBy: { snapshotAt: 'desc' },
      distinct: ['conditionId'],
    });

    return snapshots
      .filter((s) => s.size > 0)
      .map((s) => ({
        conditionId: s.conditionId,
        tokenId: s.tokenId,
        marketSlug: s.marketSlug,
        size: s.size,
        avgPrice: s.avgPrice,
        currentPrice: s.currentPrice,
        pnl: s.pnl,
      }));
  }

  async getBalance(userId: string): Promise<{ usdc: number; positions: number; total: number }> {
    const proxyWallet = await this.prisma.wallet.findUnique({
      where: { userId_type: { userId, type: 'POLY_PROXY' } },
    });

    if (!proxyWallet) {
      return { usdc: 0, positions: 0, total: 0 };
    }

    // Fetch USDC balance from on-chain or cache
    const config = getConfig();
    let usdcBalance = 0;

    try {
      const res = await fetch(
        `${config.POLYMARKET_DATA_API_URL}/balances?address=${proxyWallet.address}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { usdc?: number };
        usdcBalance = data.usdc ?? 0;
      }
    } catch {
      // Fallback: return 0
    }

    const positions = await this.getPositions(userId);
    const positionsValue = positions.reduce((sum, p) => sum + p.size * p.currentPrice, 0);

    return {
      usdc: usdcBalance,
      positions: positionsValue,
      total: usdcBalance + positionsValue,
    };
  }

  async getClaimable(userId: string): Promise<Array<{ conditionId: string; amount: number; marketSlug: string | null }>> {
    // Query resolved positions that haven't been claimed
    const positions = await this.getPositions(userId);

    // In production, check against on-chain resolved conditions
    // For now return empty - will be populated by position sync worker
    return [];
  }
}
