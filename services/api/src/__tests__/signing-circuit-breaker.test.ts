import { describe, it, expect, beforeEach } from 'vitest';
import { SigningCircuitBreaker } from '../services/signing-circuit-breaker.js';
import { SIGNING_CIRCUIT_BREAKER } from '@mirrormarkets/shared';

describe('SigningCircuitBreaker', () => {
  let cb: SigningCircuitBreaker;

  beforeEach(() => {
    cb = new SigningCircuitBreaker();
  });

  it('starts in CLOSED state', () => {
    expect(cb.getState()).toBe('CLOSED');
  });

  it('allows requests in CLOSED state', async () => {
    await expect(cb.allowRequest()).resolves.toBeUndefined();
  });

  it('transitions to OPEN after failure threshold', async () => {
    for (let i = 0; i < SIGNING_CIRCUIT_BREAKER.FAILURE_THRESHOLD; i++) {
      await cb.recordFailure();
    }
    expect(cb.getState()).toBe('OPEN');
  });

  it('rejects requests in OPEN state', async () => {
    for (let i = 0; i < SIGNING_CIRCUIT_BREAKER.FAILURE_THRESHOLD; i++) {
      await cb.recordFailure();
    }

    await expect(cb.allowRequest()).rejects.toThrow('circuit breaker is OPEN');
  });

  it('records success closes circuit in HALF_OPEN', async () => {
    // Open the circuit
    for (let i = 0; i < SIGNING_CIRCUIT_BREAKER.FAILURE_THRESHOLD; i++) {
      await cb.recordFailure();
    }
    expect(cb.getState()).toBe('OPEN');

    // Force reset to simulate timeout
    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('returns detailed stats', () => {
    const stats = cb.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.recentFailures).toBe(0);
    expect(stats.openedAt).toBeNull();
    expect(stats.halfOpenSuccesses).toBe(0);
    expect(stats.halfOpenFailures).toBe(0);
  });

  it('reset clears all state', async () => {
    for (let i = 0; i < SIGNING_CIRCUIT_BREAKER.FAILURE_THRESHOLD; i++) {
      await cb.recordFailure();
    }
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getStats().recentFailures).toBe(0);
  });
});
