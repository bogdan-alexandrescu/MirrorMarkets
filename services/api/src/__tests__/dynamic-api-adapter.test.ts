import { describe, it, expect } from 'vitest';
import { DynamicApiError } from '../adapters/dynamic-api.adapter.js';

describe('DynamicApiError', () => {
  it('creates rate limited error', () => {
    const err = new DynamicApiError('RATE_LIMITED', 'Rate limited', 429, 5);
    expect(err.errorType).toBe('RATE_LIMITED');
    expect(err.httpStatus).toBe(429);
    expect(err.retryAfterSeconds).toBe(5);
    expect(err.name).toBe('DynamicApiError');
  });

  it('creates API error without retry', () => {
    const err = new DynamicApiError('API_ERROR', 'Server error', 500);
    expect(err.errorType).toBe('API_ERROR');
    expect(err.httpStatus).toBe(500);
    expect(err.retryAfterSeconds).toBeUndefined();
  });
});
