import { PrismaClient } from '@prisma/client';
import type { PositionInfo } from '@mirrormarkets/shared';
import { POLYMARKET_CONTRACTS } from '@mirrormarkets/shared';
import { getConfig } from '../config.js';

// Native USDC on Polygon (Circle-issued)
const NATIVE_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
// ERC-20 balanceOf(address) selector
const BALANCE_OF_SELECTOR = '0x70a08231';

async function getOnChainUsdcBalance(rpcUrl: string, walletAddress: string): Promise<number> {
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

    // Fetch USDC balance directly from Polygon (USDC.e + native USDC)
    const config = getConfig();
    const usdcBalance = await getOnChainUsdcBalance(config.POLYGON_RPC_URL, proxyWallet.address);

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
