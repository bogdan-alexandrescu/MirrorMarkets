import { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type { TradingAuthorityProvider } from '@mirrormarkets/shared';
import { AppError, ErrorCodes, POLYMARKET_CONTRACTS } from '@mirrormarkets/shared';
import { CircuitBreaker } from './circuit-breaker.js';
import { evaluateGuardrails } from './guardrails.js';
import { PolymarketAdapter } from '../adapters/polymarket.adapter.js';

// Native USDC on Polygon (Circle-issued)
const NATIVE_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const BALANCE_OF_SELECTOR = '0x70a08231';
const USDC_BALANCE_TTL = 600;

/**
 * CopyEngine — Phase 2A
 *
 * Core copy-trading logic.  All signing is done through the
 * TradingAuthorityProvider — no raw private keys are used.
 *
 * If the Dynamic API is unavailable, the engine pauses (SIGNING_UNAVAILABLE)
 * and the circuit breaker opens.
 */
export class CopyEngine {
  private circuitBreaker = new CircuitBreaker();

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger,
    private tradingAuthority: TradingAuthorityProvider,
  ) {}

  async processLeaderEvent(event: {
    leaderId: string;
    conditionId: string;
    tokenId: string;
    marketSlug?: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    transactionHash?: string;
  }): Promise<void> {
    // Store leader event
    const leaderEvent = await this.prisma.leaderEvent.create({
      data: {
        leaderId: event.leaderId,
        conditionId: event.conditionId,
        tokenId: event.tokenId,
        marketSlug: event.marketSlug,
        side: event.side,
        size: event.size,
        price: event.price,
        transactionHash: event.transactionHash,
      },
    });

    await this.processCopiesForEvent(leaderEvent);
  }

  /**
   * Find all copy-enabled followers for a leader event and execute copies.
   * Called from both processLeaderEvent (new events) and the 15s poll (already-synced events).
   */
  async processCopiesForEvent(leaderEvent: any): Promise<void> {
    const follows = await this.prisma.follow.findMany({
      where: {
        leaderId: leaderEvent.leaderId,
        status: 'ACTIVE',
        user: {
          copyProfile: {
            status: 'ENABLED',
          },
        },
      },
      include: {
        user: {
          include: {
            copyProfile: true,
            wallets: true,
            polymarketCredentials: true,
            serverWallet: true,
          },
        },
      },
    });

    this.logger.info({ leaderId: leaderEvent.leaderId, followers: follows.length }, 'Processing leader event for followers');

    for (const follow of follows) {
      await this.processCopyForUser(follow.user, leaderEvent);
    }
  }

  private async processCopyForUser(user: any, leaderEvent: any): Promise<void> {
    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      await this.prisma.copyAttempt.create({
        data: {
          userId: user.id,
          leaderEventId: leaderEvent.id,
          status: 'SKIPPED',
          skipReason: 'Circuit breaker open',
        },
      });
      return;
    }

    // Check for duplicate copy
    const existingAttempt = await this.prisma.copyAttempt.findFirst({
      where: {
        userId: user.id,
        leaderEventId: leaderEvent.id,
      },
    });

    if (existingAttempt) {
      this.logger.debug({ userId: user.id, eventId: leaderEvent.id }, 'Duplicate copy attempt, skipping');
      return;
    }

    // Create pending copy attempt
    const attempt = await this.prisma.copyAttempt.create({
      data: {
        userId: user.id,
        leaderEventId: leaderEvent.id,
        status: 'PENDING',
      },
    });

    try {
      const profile = user.copyProfile;
      if (!profile) return;

      // Get trading authority address and proxy
      const proxyWallet = user.wallets.find((w: any) => w.type === 'POLY_PROXY');
      const creds = user.polymarketCredentials;

      if (!proxyWallet || !creds) {
        await this.prisma.copyAttempt.update({
          where: { id: attempt.id },
          data: { status: 'FAILED', errorMessage: 'Missing proxy wallet or credentials' },
        });
        return;
      }

      // Get open orders for guardrail evaluation
      const openOrders = await this.prisma.order.findMany({
        where: { userId: user.id, status: 'OPEN' },
      });

      // Read cached USDC balance from Redis (set by position-sync worker)
      // If cache is empty or zero, fallback to direct RPC lookup
      const cachedBalance = await this.redis.get(`user:${user.id}:usdc_balance`);
      let currentBalance = cachedBalance ? parseFloat(cachedBalance) : 0;

      if (currentBalance === 0) {
        currentBalance = await this.fetchUsdcBalance(user.id, proxyWallet.address);
      }

      // Evaluate guardrails
      const result = evaluateGuardrails({
        profile,
        openOrders,
        leaderSide: leaderEvent.side,
        leaderPrice: leaderEvent.price,
        leaderSize: leaderEvent.size,
        currentBalance,
      });

      if (!result.allowed) {
        await this.prisma.copyAttempt.update({
          where: { id: attempt.id },
          data: { status: 'SKIPPED', skipReason: result.skipReason },
        });
        this.logger.info({ userId: user.id, reason: result.skipReason }, 'Copy skipped');
        return;
      }

      // Check server wallet is ready
      const serverWallet = user.serverWallet;
      const tradingEoa = user.wallets.find((w: any) => w.type === 'TRADING_EOA');

      if (!serverWallet?.address && !tradingEoa) {
        await this.prisma.copyAttempt.update({
          where: { id: attempt.id },
          data: { status: 'FAILED', errorMessage: 'No trading authority available' },
        });
        return;
      }

      // Prefer server wallet, fall back to getting address from provider
      let tradingAddress: string;
      try {
        tradingAddress = await this.tradingAuthority.getAddress(user.id);
      } catch (error) {
        // Dynamic API unavailable — SIGNING_UNAVAILABLE
        const message = error instanceof Error ? error.message : 'Signing unavailable';
        await this.prisma.copyAttempt.update({
          where: { id: attempt.id },
          data: { status: 'FAILED', errorMessage: `SIGNING_UNAVAILABLE: ${message}` },
        });
        this.circuitBreaker.recordFailure();
        this.logger.error({ userId: user.id, err: error }, 'Signing unavailable — copy paused');
        return;
      }

      const adapter = new PolymarketAdapter(
        this.tradingAuthority,
        user.id,
        tradingAddress,
        {
          key: creds.apiKey,
          secret: creds.apiSecret,
          passphrase: creds.passphrase,
        },
        creds.isProxyDeployed ? proxyWallet.address : undefined,
      );

      const orderResult = await adapter.createOrder({
        tokenId: leaderEvent.tokenId,
        side: leaderEvent.side,
        size: result.adjustedSize,
        price: result.adjustedPrice,
      });

      // Store order
      const order = await this.prisma.order.create({
        data: {
          userId: user.id,
          polyOrderId: orderResult.orderID ?? orderResult.id,
          conditionId: leaderEvent.conditionId,
          tokenId: leaderEvent.tokenId,
          marketSlug: leaderEvent.marketSlug,
          side: leaderEvent.side,
          size: result.adjustedSize,
          price: result.adjustedPrice,
          status: 'OPEN',
        },
      });

      await this.prisma.copyAttempt.update({
        where: { id: attempt.id },
        data: { status: 'SUBMITTED', orderId: order.id },
      });

      this.circuitBreaker.recordSuccess();

      this.logger.info(
        { userId: user.id, orderId: order.id, size: result.adjustedSize },
        'Copy trade submitted',
      );
    } catch (error) {
      this.circuitBreaker.recordFailure();

      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.copyAttempt.update({
        where: { id: attempt.id },
        data: { status: 'FAILED', errorMessage: message },
      });

      this.logger.error({ userId: user.id, err: error }, 'Copy trade failed');
    }
  }

  private async fetchUsdcBalance(userId: string, walletAddress: string): Promise<number> {
    const rpcUrl = process.env.POLYGON_RPC_URL ?? 'https://polygon-bor-rpc.publicnode.com';
    const paddedAddr = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const callData = `${BALANCE_OF_SELECTOR}${paddedAddr}`;

    const callContract = async (contractAddr: string): Promise<bigint> => {
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', method: 'eth_call',
            params: [{ to: contractAddr, data: callData }, 'latest'], id: 1,
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

    const balance = Number(usdcE + native) / 1e6;

    // Cache for future lookups
    if (balance > 0) {
      await this.redis.set(`user:${userId}:usdc_balance`, balance.toString(), 'EX', USDC_BALANCE_TTL);
    }

    return balance;
  }
}
