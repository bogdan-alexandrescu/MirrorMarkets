import { z } from 'zod';
import { DEFAULT_GUARDRAILS, PAGINATION } from './constants.js';

// Auth
export const verifyDynamicSchema = z.object({
  token: z.string().min(1),
});

// Follows
export const createFollowSchema = z.object({
  leaderAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

// Copy Profile
export const updateCopyProfileSchema = z.object({
  maxPositionSizeUsd: z.number().min(1).max(10000).optional(),
  maxOpenPositions: z.number().int().min(1).max(100).optional(),
  copyPercentage: z.number().min(1).max(100).optional(),
  minOdds: z.number().min(0.01).max(0.99).optional(),
  maxOdds: z.number().min(0.01).max(0.99).optional(),
  enabledMarketIds: z.array(z.string()).optional(),
  blockedMarketIds: z.array(z.string()).optional(),
});

// Orders
export const createOrderSchema = z.object({
  tokenId: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  size: z.number().positive(),
  price: z.number().min(0.01).max(0.99),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
});

// Withdrawals
export const createWithdrawalSchema = z.object({
  amount: z.number().positive(),
  destinationAddr: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

// Claims
export const redeemSchema = z.object({
  conditionId: z.string().min(1),
});

export const updateAutoClaimSchema = z.object({
  enabled: z.boolean(),
  minClaimableUsd: z.number().min(0.01).max(10000).optional(),
});

// Search
export const searchUsersSchema = z.object({
  query: z.string().min(1).max(200),
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
});

// Guardrails (used by copy engine)
export const guardrailsSchema = z.object({
  maxPositionSizeUsd: z.number().default(DEFAULT_GUARDRAILS.MAX_POSITION_SIZE_USD),
  maxOpenPositions: z.number().int().default(DEFAULT_GUARDRAILS.MAX_OPEN_POSITIONS),
  copyPercentage: z.number().default(DEFAULT_GUARDRAILS.COPY_PERCENTAGE),
  minOdds: z.number().default(DEFAULT_GUARDRAILS.MIN_ODDS),
  maxOdds: z.number().default(DEFAULT_GUARDRAILS.MAX_ODDS),
});

// Admin
export const retryRelayerSchema = z.object({
  txId: z.string().min(1),
});
