import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '../engine/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeoutMs: 100,
      halfOpenMaxCalls: 1,
    });
  });

  it('starts in CLOSED state', () => {
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.canExecute()).toBe(true);
  });

  it('opens after reaching failure threshold', () => {
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.canExecute()).toBe(true);

    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
    expect(cb.canExecute()).toBe(false);
  });

  it('transitions to HALF_OPEN after recovery timeout', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');

    await new Promise((r) => setTimeout(r, 150));

    expect(cb.getState()).toBe('HALF_OPEN');
    expect(cb.canExecute()).toBe(true);
  });

  it('closes on success in HALF_OPEN state', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();

    await new Promise((r) => setTimeout(r, 150));

    expect(cb.canExecute()).toBe(true);
    cb.recordSuccess();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('re-opens on failure in HALF_OPEN state', async () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();

    await new Promise((r) => setTimeout(r, 150));

    cb.canExecute(); // triggers HALF_OPEN transition
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
  });

  it('resets to clean state', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.canExecute()).toBe(true);
  });

  it('resets failure count on success', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();

    // Should need 3 more failures to open
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED');
  });
});
