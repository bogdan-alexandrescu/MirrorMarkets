import { SIGNING_CIRCUIT_BREAKER, ErrorCodes, AppError } from '@mirrormarkets/shared';
import { AuditService } from './audit.service.js';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * SigningCircuitBreaker — protects the system from cascading failures when
 * the Dynamic Server Wallet API experiences outages.
 *
 * State machine:
 *   CLOSED → counts failures; opens if threshold exceeded within window
 *   OPEN   → rejects all requests; transitions to HALF_OPEN after recovery timeout
 *   HALF_OPEN → allows limited requests; closes on success, re-opens on failure
 *
 * This is separate from the copy trading circuit breaker (which protects
 * against order submission failures).
 */
export class SigningCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number[] = [];
  private halfOpenSuccesses = 0;
  private halfOpenFailures = 0;
  private openedAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly windowMs: number;
  private readonly recoveryTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;

  constructor(private auditService?: AuditService) {
    this.failureThreshold = SIGNING_CIRCUIT_BREAKER.FAILURE_THRESHOLD;
    this.windowMs = SIGNING_CIRCUIT_BREAKER.WINDOW_MS;
    this.recoveryTimeoutMs = SIGNING_CIRCUIT_BREAKER.RECOVERY_TIMEOUT_MS;
    this.halfOpenMaxCalls = SIGNING_CIRCUIT_BREAKER.HALF_OPEN_MAX_CALLS;
  }

  /**
   * Check if a request is allowed. Throws if the circuit is open.
   */
  async allowRequest(): Promise<void> {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now - (this.openedAt ?? 0) >= this.recoveryTimeoutMs) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new AppError(
          ErrorCodes.SIGNING_CIRCUIT_BREAKER_OPEN,
          'Signing service circuit breaker is OPEN — Dynamic API may be experiencing issues',
          503,
          { state: this.state, openedAt: this.openedAt },
        );
      }
    }

    if (this.state === 'HALF_OPEN') {
      const totalHalfOpen = this.halfOpenSuccesses + this.halfOpenFailures;
      if (totalHalfOpen >= this.halfOpenMaxCalls) {
        throw new AppError(
          ErrorCodes.SIGNING_CIRCUIT_BREAKER_OPEN,
          'Signing service circuit breaker is HALF_OPEN — probe limit reached',
          503,
          { state: this.state },
        );
      }
    }
  }

  /**
   * Record a successful signing operation.
   */
  async recordSuccess(): Promise<void> {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.halfOpenMaxCalls) {
        this.transitionTo('CLOSED');
      }
    }
    // In CLOSED state, successes are a no-op (we only track failures)
  }

  /**
   * Record a failed signing operation.
   */
  async recordFailure(): Promise<void> {
    const now = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.halfOpenFailures++;
      this.transitionTo('OPEN');
      return;
    }

    // CLOSED state — track failure in sliding window
    this.failures.push(now);
    this.pruneFailures(now);

    if (this.failures.length >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Get the current state of the circuit breaker.
   */
  getState(): CircuitState {
    // Auto-transition from OPEN to HALF_OPEN if recovery timeout has passed
    if (this.state === 'OPEN' && this.openedAt) {
      if (Date.now() - this.openedAt >= this.recoveryTimeoutMs) {
        this.transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  /**
   * Get detailed stats for health check reporting.
   */
  getStats(): {
    state: CircuitState;
    recentFailures: number;
    openedAt: number | null;
    halfOpenSuccesses: number;
    halfOpenFailures: number;
  } {
    const now = Date.now();
    this.pruneFailures(now);
    return {
      state: this.getState(),
      recentFailures: this.failures.length,
      openedAt: this.openedAt,
      halfOpenSuccesses: this.halfOpenSuccesses,
      halfOpenFailures: this.halfOpenFailures,
    };
  }

  /**
   * Force reset — admin use only.
   */
  reset(): void {
    this.transitionTo('CLOSED');
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'OPEN') {
      this.openedAt = Date.now();
      this.halfOpenSuccesses = 0;
      this.halfOpenFailures = 0;
      this.auditService?.log({
        action: 'SIGNING_FAILED',
        details: {
          circuitBreaker: true,
          transition: `${oldState} → OPEN`,
          recentFailures: this.failures.length,
        },
      });
    } else if (newState === 'HALF_OPEN') {
      this.halfOpenSuccesses = 0;
      this.halfOpenFailures = 0;
    } else if (newState === 'CLOSED') {
      this.failures = [];
      this.openedAt = null;
      this.halfOpenSuccesses = 0;
      this.halfOpenFailures = 0;
    }
  }

  private pruneFailures(now: number): void {
    while (this.failures.length > 0 && now - this.failures[0]! >= this.windowMs) {
      this.failures.shift();
    }
  }
}
