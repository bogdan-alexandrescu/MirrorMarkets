import { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { Logger } from 'pino';
import { WORKER_INTERVALS } from '@mirrormarkets/shared';

export class HealthCheckWorker {
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

    const pollMs = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS ?? '') || WORKER_INTERVALS.HEALTH_CHECK_MS;

    this.logger.info({ pollMs }, 'Health check worker started');

    this.interval = setInterval(() => this.check(), pollMs);
    this.check();
  }

  stop(): void {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.logger.info('Health check worker stopped');
  }

  private async check(): Promise<void> {
    try {
      await this.redis.set('worker:health-check:last-ping', Date.now().toString());

      const checks: Record<string, string> = {};

      // Check database
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        checks.database = 'ok';
      } catch {
        checks.database = 'down';
      }

      // Check Redis
      try {
        await this.redis.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'down';
      }

      // Check Polymarket CLOB
      try {
        const res = await fetch('https://clob.polymarket.com/time');
        checks.polymarketClob = res.ok ? 'ok' : 'degraded';
      } catch {
        checks.polymarketClob = 'down';
      }

      // Store health status
      await this.redis.set(
        'system:health',
        JSON.stringify({ ...checks, checkedAt: new Date().toISOString() }),
        'EX',
        120,
      );

      const hasIssues = Object.values(checks).some((v) => v !== 'ok');
      if (hasIssues) {
        this.logger.warn({ checks }, 'Health check detected issues');
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Health check error');
    }
  }
}
