import {
  SIGNING_RATE_LIMITS,
  SigningRateLimitError,
  ErrorCodes,
} from '@mirrormarkets/shared';
import { AuditService } from './audit.service.js';

/**
 * SigningRateLimiter — in-memory sliding window rate limiter for signing operations.
 *
 * Enforces two limits:
 *   1. Per-user: max N signing requests per minute
 *   2. Global: max N signing requests per minute across all users
 *
 * Uses a sliding window counter backed by arrays of timestamps.
 * For a production cluster, this should be replaced with a Redis-backed
 * implementation — the interface is designed for that swap.
 */
export class SigningRateLimiter {
  private perUserWindows = new Map<string, number[]>();
  private globalWindow: number[] = [];
  private readonly windowMs = 60_000;

  constructor(private auditService?: AuditService) {}

  /**
   * Check if the signing request is allowed. Throws if rate limited.
   */
  async checkAndIncrement(userId: string): Promise<void> {
    const now = Date.now();

    // Per-user check
    const userWindow = this.getOrCreateUserWindow(userId);
    this.pruneWindow(userWindow, now);
    if (userWindow.length >= SIGNING_RATE_LIMITS.PER_USER_PER_MINUTE) {
      await this.auditService?.log({
        userId,
        action: 'SIGN_RATE_LIMITED',
        details: { limitType: 'per_user', count: userWindow.length },
      });
      throw new SigningRateLimitError(userId, 'per_user');
    }

    // Global check
    this.pruneWindow(this.globalWindow, now);
    if (this.globalWindow.length >= SIGNING_RATE_LIMITS.GLOBAL_PER_MINUTE) {
      await this.auditService?.log({
        userId,
        action: 'SIGN_RATE_LIMITED',
        details: { limitType: 'global', count: this.globalWindow.length },
      });
      throw new SigningRateLimitError(userId, 'global');
    }

    // Allowed — record the request
    userWindow.push(now);
    this.globalWindow.push(now);
  }

  /**
   * Check without incrementing — useful for health checks.
   */
  isWithinLimits(userId: string): { perUser: boolean; global: boolean } {
    const now = Date.now();

    const userWindow = this.perUserWindows.get(userId) ?? [];
    const prunedUser = userWindow.filter((t) => now - t < this.windowMs);
    const prunedGlobal = this.globalWindow.filter((t) => now - t < this.windowMs);

    return {
      perUser: prunedUser.length < SIGNING_RATE_LIMITS.PER_USER_PER_MINUTE,
      global: prunedGlobal.length < SIGNING_RATE_LIMITS.GLOBAL_PER_MINUTE,
    };
  }

  /**
   * Get current usage stats.
   */
  getStats(): {
    globalCount: number;
    globalLimit: number;
    userCount: number;
    activeUsers: number;
  } {
    const now = Date.now();
    this.pruneWindow(this.globalWindow, now);

    let totalUserRequests = 0;
    for (const [, window] of this.perUserWindows) {
      this.pruneWindow(window, now);
      totalUserRequests += window.length;
    }

    return {
      globalCount: this.globalWindow.length,
      globalLimit: SIGNING_RATE_LIMITS.GLOBAL_PER_MINUTE,
      userCount: totalUserRequests,
      activeUsers: this.perUserWindows.size,
    };
  }

  private getOrCreateUserWindow(userId: string): number[] {
    let window = this.perUserWindows.get(userId);
    if (!window) {
      window = [];
      this.perUserWindows.set(userId, window);
    }
    return window;
  }

  private pruneWindow(window: number[], now: number): void {
    while (window.length > 0 && now - window[0]! >= this.windowMs) {
      window.shift();
    }
  }
}
