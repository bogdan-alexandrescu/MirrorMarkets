import { CIRCUIT_BREAKER } from '@mirrormarkets/shared';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenCallCount = 0;

  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;

  constructor(options?: {
    failureThreshold?: number;
    recoveryTimeoutMs?: number;
    halfOpenMaxCalls?: number;
  }) {
    this.failureThreshold = options?.failureThreshold ?? CIRCUIT_BREAKER.FAILURE_THRESHOLD;
    this.recoveryTimeoutMs = options?.recoveryTimeoutMs ?? CIRCUIT_BREAKER.RECOVERY_TIMEOUT_MS;
    this.halfOpenMaxCalls = options?.halfOpenMaxCalls ?? CIRCUIT_BREAKER.HALF_OPEN_MAX_CALLS;
  }

  canExecute(): boolean {
    switch (this.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (Date.now() - this.lastFailureTime >= this.recoveryTimeoutMs) {
          this.state = 'HALF_OPEN';
          this.halfOpenCallCount = 0;
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return this.halfOpenCallCount < this.halfOpenMaxCalls;
    }
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
    this.failureCount = 0;
    this.halfOpenCallCount = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    // Re-check in case timeout has elapsed
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime >= this.recoveryTimeoutMs) {
      return 'HALF_OPEN';
    }
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenCallCount = 0;
  }
}
