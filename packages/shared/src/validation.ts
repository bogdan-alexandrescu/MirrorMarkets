import { z } from 'zod';
import { DEFAULT_GUARDRAILS, PAGINATION, SAFE_MODULE } from './constants.js';

const ethAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const bytes4Selector = z.string().regex(/^0x[a-fA-F0-9]{8}$/);

// Auth
export const verifyDynamicSchema = z.object({
  token: z.string().min(1),
});

// Follows
export const createFollowSchema = z.object({
  leaderAddress: ethAddress,
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
  destinationAddr: ethAddress,
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

// ─── Phase 2A: Binding Proof ────────────────────────────

export const submitBindingProofSchema = z.object({
  embeddedWalletAddress: ethAddress,
  serverWalletAddress: ethAddress,
  nonce: z.string().min(1).max(64),
  timestamp: z.number().int().positive(),
  signature: z.string().min(1),
});

// ─── Phase 2B: Safe Automation ──────────────────────────

export const constraintsSchema = z.object({
  maxNotionalPerTrade: z.number().min(0).max(1_000_000).default(SAFE_MODULE.DEFAULT_MAX_NOTIONAL_PER_TRADE),
  maxNotionalPerDay: z.number().min(0).max(10_000_000).default(SAFE_MODULE.DEFAULT_MAX_NOTIONAL_PER_DAY),
  maxTxPerHour: z.number().int().min(0).max(1_000).default(SAFE_MODULE.DEFAULT_MAX_TX_PER_HOUR),
  expiryTimestamp: z.number().int().min(0).default(0),
  allowedTargets: z.array(ethAddress).default([]),
  allowedSelectors: z.array(bytes4Selector).default([]),
  tokenAllowlist: z.array(ethAddress).default([]),
});

export const enableModuleSchema = z.object({
  safeAddress: ethAddress,
  moduleAddress: ethAddress,
  ownerSignature: z.string().min(1),
});

export const updateConstraintsSchema = z.object({
  constraints: constraintsSchema,
});

export const updateSigningModeSchema = z.object({
  signingMode: z.enum(['DYNAMIC_SERVER_WALLET', 'EIP1271_SAFE', 'USER_EMBEDDED_WALLET']),
});

export const registerSessionKeySchema = z.object({
  constraints: constraintsSchema,
  expiresInSeconds: z.number().int().min(3600).max(30 * 24 * 60 * 60).default(SAFE_MODULE.DEFAULT_SESSION_KEY_TTL),
});

export const revokeSessionKeySchema = z.object({
  sessionKeyId: z.string().min(1),
});

export const addWithdrawalAllowlistSchema = z.object({
  address: ethAddress,
  label: z.string().max(100).optional(),
});

export const removeWithdrawalAllowlistSchema = z.object({
  address: ethAddress,
});
