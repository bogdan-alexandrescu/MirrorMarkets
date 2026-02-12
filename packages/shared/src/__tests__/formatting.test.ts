import { describe, it, expect } from 'vitest';
import { shortenAddress, formatUsd, formatPercentage, formatPnl, toFixedNumber } from '../utils/formatting.js';

describe('shortenAddress', () => {
  it('shortens an Ethereum address', () => {
    expect(shortenAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678');
  });

  it('uses custom char count', () => {
    expect(shortenAddress('0x1234567890abcdef1234567890abcdef12345678', 6)).toBe('0x123456...345678');
  });
});

describe('formatUsd', () => {
  it('formats positive amounts', () => {
    expect(formatUsd(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });
});

describe('formatPercentage', () => {
  it('formats decimal as percentage', () => {
    expect(formatPercentage(0.55)).toBe('55.0%');
  });

  it('respects decimal places', () => {
    expect(formatPercentage(0.123, 2)).toBe('12.30%');
  });
});

describe('formatPnl', () => {
  it('formats positive PnL with plus sign', () => {
    expect(formatPnl(100)).toBe('+$100.00');
  });

  it('formats negative PnL', () => {
    const result = formatPnl(-50);
    expect(result).toContain('50.00');
  });
});

describe('toFixedNumber', () => {
  it('rounds to specified decimals', () => {
    expect(toFixedNumber(1.23456, 2)).toBe(1.23);
    expect(toFixedNumber(1.235, 2)).toBe(1.24);
  });
});
