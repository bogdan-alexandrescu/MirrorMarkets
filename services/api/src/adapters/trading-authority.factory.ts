import { PrismaClient } from '@prisma/client';
import type { TradingAuthorityProvider } from '@mirrormarkets/shared';
import { getConfig } from '../config.js';
import { DynamicServerWalletProvider } from './dynamic-server-wallet.provider.js';
import { MockDynamicServerWalletProvider } from './mock-server-wallet.provider.js';
import { CrossmintApiAdapter } from './crossmint-api.adapter.js';
import { SigningRequestService } from '../services/signing-request.service.js';
import { SigningRateLimiter } from '../services/signing-rate-limiter.js';
import { SigningCircuitBreaker } from '../services/signing-circuit-breaker.js';
import { AuditService } from '../services/audit.service.js';

let _provider: TradingAuthorityProvider | null = null;
let _signingCircuitBreaker: SigningCircuitBreaker | null = null;
let _signingRateLimiter: SigningRateLimiter | null = null;

/**
 * Returns a singleton TradingAuthorityProvider based on configuration.
 *
 * Priority:
 *   1. CROSSMINT_API_KEY set → Crossmint MPC wallets (preferred)
 *   2. Otherwise → MockDynamicServerWalletProvider (dev/test)
 *
 * The factory is idempotent — calling it multiple times with the same
 * PrismaClient returns the same instance.
 */
export function getTradingAuthorityProvider(prisma: PrismaClient): TradingAuthorityProvider {
  if (_provider) return _provider;

  const config = getConfig();
  const auditService = new AuditService(prisma);

  if (config.CROSSMINT_API_KEY) {
    const adapter = new CrossmintApiAdapter(config.CROSSMINT_API_KEY, config.CROSSMINT_BASE_URL);
    const signingService = new SigningRequestService(prisma);
    _signingRateLimiter = new SigningRateLimiter(auditService);
    _signingCircuitBreaker = new SigningCircuitBreaker(auditService);

    _provider = new DynamicServerWalletProvider(prisma, {
      adapter,
      providerName: 'CROSSMINT',
      signingService,
      rateLimiter: _signingRateLimiter,
      circuitBreaker: _signingCircuitBreaker,
      auditService,
    });
  } else {
    _provider = new MockDynamicServerWalletProvider(prisma);
  }

  return _provider;
}

/**
 * Get the signing circuit breaker instance (for health checks).
 * Returns null if using mock provider.
 */
export function getSigningCircuitBreaker(): SigningCircuitBreaker | null {
  return _signingCircuitBreaker;
}

/**
 * Get the signing rate limiter instance (for health checks).
 * Returns null if using mock provider.
 */
export function getSigningRateLimiter(): SigningRateLimiter | null {
  return _signingRateLimiter;
}

/**
 * Reset the singleton — only used in tests.
 */
export function resetTradingAuthorityProvider(): void {
  _provider = null;
  _signingCircuitBreaker = null;
  _signingRateLimiter = null;
}
