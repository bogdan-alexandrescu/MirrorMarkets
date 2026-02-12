import { describe, it, expect } from 'vitest';
import { evaluateGuardrails, type GuardrailContext } from '../engine/guardrails.js';

function makeContext(overrides: Partial<GuardrailContext> = {}): GuardrailContext {
  return {
    profile: {
      id: 'p1',
      userId: 'u1',
      status: 'ENABLED',
      maxPositionSizeUsd: 50,
      maxOpenPositions: 10,
      copyPercentage: 100,
      minOdds: 0.05,
      maxOdds: 0.95,
      enabledMarketIds: [],
      blockedMarketIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    openOrders: [],
    leaderSide: 'BUY',
    leaderPrice: 0.5,
    leaderSize: 20,
    currentBalance: 1000,
    ...overrides,
  };
}

describe('evaluateGuardrails', () => {
  it('allows valid trade', () => {
    const result = evaluateGuardrails(makeContext());
    expect(result.allowed).toBe(true);
    expect(result.adjustedSize).toBe(20);
  });

  it('skips when price below minOdds', () => {
    const result = evaluateGuardrails(makeContext({ leaderPrice: 0.02 }));
    expect(result.allowed).toBe(false);
    expect(result.skipReason).toContain('outside odds range');
  });

  it('skips when price above maxOdds', () => {
    const result = evaluateGuardrails(makeContext({ leaderPrice: 0.98 }));
    expect(result.allowed).toBe(false);
    expect(result.skipReason).toContain('outside odds range');
  });

  it('caps size by maxPositionSizeUsd', () => {
    const result = evaluateGuardrails(makeContext({ leaderSize: 200, leaderPrice: 0.5 }));
    // maxPositionSizeUsd=50, price=0.5, so max size = 50/0.5 = 100
    expect(result.allowed).toBe(true);
    expect(result.adjustedSize).toBe(100);
  });

  it('caps size by available balance', () => {
    const result = evaluateGuardrails(makeContext({ currentBalance: 5, leaderSize: 20, leaderPrice: 0.5 }));
    // balance=5, price=0.5, so max size = 5/0.5 = 10
    expect(result.allowed).toBe(true);
    expect(result.adjustedSize).toBe(10);
  });

  it('skips when balance insufficient', () => {
    const result = evaluateGuardrails(makeContext({ currentBalance: 0.01 }));
    expect(result.allowed).toBe(false);
    expect(result.skipReason).toContain('Insufficient balance');
  });

  it('applies copy percentage', () => {
    const ctx = makeContext();
    ctx.profile.copyPercentage = 50;
    const result = evaluateGuardrails(ctx);
    expect(result.allowed).toBe(true);
    expect(result.adjustedSize).toBe(10); // 50% of 20
  });

  it('skips when max open positions reached', () => {
    const orders = Array.from({ length: 10 }, (_, i) => ({
      id: `o${i}`,
      userId: 'u1',
      polyOrderId: `po${i}`,
      conditionId: `c${i}`, // unique conditions
      tokenId: `t${i}`,
      marketSlug: null,
      side: 'BUY' as const,
      size: 10,
      price: 0.5,
      filledSize: 0,
      status: 'OPEN' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = evaluateGuardrails(makeContext({ openOrders: orders }));
    expect(result.allowed).toBe(false);
    expect(result.skipReason).toContain('Max open positions');
  });

  it('allows sells even at max positions', () => {
    const orders = Array.from({ length: 10 }, (_, i) => ({
      id: `o${i}`,
      userId: 'u1',
      polyOrderId: `po${i}`,
      conditionId: `c${i}`,
      tokenId: `t${i}`,
      marketSlug: null,
      side: 'BUY' as const,
      size: 10,
      price: 0.5,
      filledSize: 0,
      status: 'OPEN' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = evaluateGuardrails(makeContext({ openOrders: orders, leaderSide: 'SELL' }));
    expect(result.allowed).toBe(true);
  });
});
