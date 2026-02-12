import { describe, it, expect } from 'vitest';
import {
  verifyDynamicSchema,
  createFollowSchema,
  updateCopyProfileSchema,
  createOrderSchema,
  createWithdrawalSchema,
  paginationSchema,
} from '../validation.js';

describe('verifyDynamicSchema', () => {
  it('accepts valid token', () => {
    const result = verifyDynamicSchema.parse({ token: 'abc123' });
    expect(result.token).toBe('abc123');
  });

  it('rejects empty token', () => {
    expect(() => verifyDynamicSchema.parse({ token: '' })).toThrow();
  });

  it('rejects missing token', () => {
    expect(() => verifyDynamicSchema.parse({})).toThrow();
  });
});

describe('createFollowSchema', () => {
  it('accepts valid address', () => {
    const result = createFollowSchema.parse({
      leaderAddress: '0x1234567890abcdef1234567890abcdef12345678',
    });
    expect(result.leaderAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('rejects invalid address', () => {
    expect(() => createFollowSchema.parse({ leaderAddress: 'invalid' })).toThrow();
    expect(() => createFollowSchema.parse({ leaderAddress: '0xshort' })).toThrow();
  });
});

describe('updateCopyProfileSchema', () => {
  it('accepts partial updates', () => {
    const result = updateCopyProfileSchema.parse({ maxPositionSizeUsd: 100 });
    expect(result.maxPositionSizeUsd).toBe(100);
  });

  it('accepts empty object', () => {
    const result = updateCopyProfileSchema.parse({});
    expect(result).toEqual({});
  });

  it('rejects out-of-range values', () => {
    expect(() => updateCopyProfileSchema.parse({ maxPositionSizeUsd: 0 })).toThrow();
    expect(() => updateCopyProfileSchema.parse({ copyPercentage: 101 })).toThrow();
    expect(() => updateCopyProfileSchema.parse({ minOdds: 0 })).toThrow();
  });
});

describe('createOrderSchema', () => {
  it('accepts valid order', () => {
    const result = createOrderSchema.parse({
      tokenId: 'token123',
      side: 'BUY',
      size: 10,
      price: 0.55,
    });
    expect(result.side).toBe('BUY');
  });

  it('rejects invalid side', () => {
    expect(() =>
      createOrderSchema.parse({ tokenId: 't', side: 'HOLD', size: 1, price: 0.5 }),
    ).toThrow();
  });

  it('rejects price out of range', () => {
    expect(() =>
      createOrderSchema.parse({ tokenId: 't', side: 'BUY', size: 1, price: 1.5 }),
    ).toThrow();
  });
});

describe('createWithdrawalSchema', () => {
  it('accepts valid withdrawal', () => {
    const result = createWithdrawalSchema.parse({
      amount: 100,
      destinationAddr: '0x1234567890abcdef1234567890abcdef12345678',
    });
    expect(result.amount).toBe(100);
  });

  it('rejects negative amount', () => {
    expect(() =>
      createWithdrawalSchema.parse({
        amount: -10,
        destinationAddr: '0x1234567890abcdef1234567890abcdef12345678',
      }),
    ).toThrow();
  });
});

describe('paginationSchema', () => {
  it('uses defaults', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('coerces string numbers', () => {
    const result = paginationSchema.parse({ page: '3', pageSize: '50' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it('caps page size', () => {
    expect(() => paginationSchema.parse({ pageSize: 200 })).toThrow();
  });
});
