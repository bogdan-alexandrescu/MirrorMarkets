import { describe, it, expect, beforeEach } from 'vitest';
import { SigningRateLimiter } from '../services/signing-rate-limiter.js';
import { SIGNING_RATE_LIMITS } from '@mirrormarkets/shared';

describe('SigningRateLimiter', () => {
  let limiter: SigningRateLimiter;

  beforeEach(() => {
    limiter = new SigningRateLimiter();
  });

  it('allows requests within per-user limit', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(limiter.checkAndIncrement('user1')).resolves.toBeUndefined();
    }
  });

  it('rejects when per-user limit exceeded', async () => {
    for (let i = 0; i < SIGNING_RATE_LIMITS.PER_USER_PER_MINUTE; i++) {
      await limiter.checkAndIncrement('user1');
    }

    await expect(limiter.checkAndIncrement('user1')).rejects.toThrow('Signing rate limit exceeded (per_user)');
  });

  it('allows different users independently', async () => {
    for (let i = 0; i < SIGNING_RATE_LIMITS.PER_USER_PER_MINUTE; i++) {
      await limiter.checkAndIncrement('user1');
    }

    // user2 should still be allowed
    await expect(limiter.checkAndIncrement('user2')).resolves.toBeUndefined();
  });

  it('isWithinLimits reports correctly', async () => {
    const result = limiter.isWithinLimits('user1');
    expect(result.perUser).toBe(true);
    expect(result.global).toBe(true);
  });

  it('getStats returns usage data', async () => {
    await limiter.checkAndIncrement('user1');
    await limiter.checkAndIncrement('user2');

    const stats = limiter.getStats();
    expect(stats.globalCount).toBe(2);
    expect(stats.globalLimit).toBe(SIGNING_RATE_LIMITS.GLOBAL_PER_MINUTE);
    expect(stats.activeUsers).toBe(2);
  });
});
