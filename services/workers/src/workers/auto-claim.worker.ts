import { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { WORKER_INTERVALS } from '@mirrormarkets/shared';

export class AutoClaimWorker {
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

    const pollMs = parseInt(process.env.AUTO_CLAIM_INTERVAL_MS ?? '') || WORKER_INTERVALS.AUTO_CLAIM_MS;

    this.logger.info({ pollMs }, 'Auto-claim worker started');

    this.interval = setInterval(() => this.poll(), pollMs);
  }

  stop(): void {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.logger.info('Auto-claim worker stopped');
  }

  private async poll(): Promise<void> {
    try {
      await this.redis.set('worker:auto-claim:last-ping', Date.now().toString());

      // Find users with auto-claim enabled
      const settings = await this.prisma.autoClaimSettings.findMany({
        where: { enabled: true },
        include: {
          user: {
            include: {
              wallets: true,
              polymarketCredentials: true,
            },
          },
        },
      });

      for (const setting of settings) {
        try {
          await this.processUserClaims(setting);
        } catch (error) {
          this.logger.error(
            { userId: setting.userId, err: error },
            'Auto-claim failed for user',
          );

          await this.prisma.autoClaimRun.create({
            data: {
              userId: setting.userId,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Auto-claim poll error');
    }
  }

  private async processUserClaims(setting: any): Promise<void> {
    // In production, query on-chain for resolved conditions
    // where the user holds winning tokens
    this.logger.debug({ userId: setting.userId }, 'Checking claimable positions');

    // Placeholder: actual claim logic would use RelayerAdapter
    // to call redeemPositions for each resolved condition

    await this.prisma.autoClaimRun.create({
      data: {
        userId: setting.userId,
        claimedCount: 0,
        claimedUsd: 0,
      },
    });
  }
}
