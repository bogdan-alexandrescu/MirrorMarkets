// Domain types - mirrors Prisma models for API layer

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface WalletInfo {
  type: 'DYNAMIC_EOA' | 'TRADING_EOA' | 'SERVER_WALLET' | 'POLY_PROXY';
  address: string;
}

export interface ServerWalletInfo {
  id: string;
  userId: string;
  dynamicServerWalletId: string;
  address: string;
  status: 'CREATING' | 'READY' | 'FAILED';
  lastError: string | null;
  createdAt: string;
}

export interface ProvisioningStatus {
  serverWallet: boolean;
  serverWalletReady: boolean;
  polyProxy: boolean;
  clobCredentials: boolean;
  copyProfile: boolean;
  complete: boolean;
  /** @deprecated Legacy fields kept for backwards compat */
  dynamicEoa?: boolean;
  tradingEoa?: boolean;
  serverWalletCreating?: boolean;
  clobApiKey?: boolean;
  bindingProof?: boolean;
}

export interface LeaderInfo {
  id: string;
  address: string;
  displayName: string | null;
  profileImageUrl: string | null;
  pnl: number;
  volume: number;
  rank: number | null;
}

export interface FollowInfo {
  id: string;
  leader: LeaderInfo;
  status: 'ACTIVE' | 'PAUSED' | 'REMOVED';
  createdAt: string;
}

export interface CopyProfileInfo {
  status: 'DISABLED' | 'ENABLED' | 'PAUSED';
  maxPositionSizeUsd: number;
  maxOpenPositions: number;
  copyPercentage: number;
  minOdds: number;
  maxOdds: number;
  enabledMarketIds: string[];
  blockedMarketIds: string[];
}

export interface CopyAttemptInfo {
  id: string;
  leaderEvent: LeaderEventInfo;
  status: 'PENDING' | 'SUBMITTED' | 'FILLED' | 'PARTIALLY_FILLED' | 'FAILED' | 'SKIPPED';
  skipReason: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface LeaderEventInfo {
  id: string;
  leaderId: string;
  conditionId: string;
  tokenId: string;
  marketSlug: string | null;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  detectedAt: string;
}

export interface OrderInfo {
  id: string;
  polyOrderId: string | null;
  conditionId: string;
  tokenId: string;
  marketSlug: string | null;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  filledSize: number;
  status: 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'EXPIRED';
  createdAt: string;
}

export interface FillInfo {
  id: string;
  orderId: string;
  size: number;
  price: number;
  side: 'BUY' | 'SELL';
  fee: number;
  filledAt: string;
}

export interface PositionInfo {
  conditionId: string;
  tokenId: string;
  marketSlug: string | null;
  size: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
}

export interface WithdrawalInfo {
  id: string;
  amount: number;
  destinationAddr: string;
  status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
  transactionHash: string | null;
  createdAt: string;
}

export interface AutoClaimSettingsInfo {
  enabled: boolean;
  minClaimableUsd: number;
}

export interface SystemStatus {
  api: 'ok' | 'degraded' | 'down';
  database: 'ok' | 'degraded' | 'down';
  redis: 'ok' | 'degraded' | 'down';
  dynamicApi: 'ok' | 'degraded' | 'down';
  polymarketClob: 'ok' | 'degraded' | 'down';
  relayer: 'ok' | 'degraded' | 'down';
  signing: 'ok' | 'degraded' | 'down';
  workers: {
    copyTrading: 'running' | 'stopped' | 'error';
    autoClaim: 'running' | 'stopped' | 'error';
    healthCheck: 'running' | 'stopped' | 'error';
    positionSync: 'running' | 'stopped' | 'error';
  };
  signingStats: {
    totalRequests1h: number;
    failedRequests1h: number;
    avgLatencyMs: number;
    circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  };
  lastCheckedAt: string;
}

export interface AuditLogInfo {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface SSEEvent {
  type: 'copy_attempt' | 'order_update' | 'fill' | 'audit' | 'system' | 'signing' | 'module_tx' | 'sync_log';
  data: Record<string, unknown>;
  timestamp: string;
}

export interface SyncLogInfo {
  id: string;
  leaderAddress: string;
  leaderName: string | null;
  tradesFound: number;
  message: string;
  level: 'info' | 'warn' | 'error';
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ─── Phase 2A: Signing Request Info ─────────────────────

export interface SigningRequestInfo {
  id: string;
  requestType: 'TYPED_DATA' | 'MESSAGE' | 'TX';
  purpose: string;
  status: 'CREATED' | 'SENT' | 'SUCCEEDED' | 'FAILED' | 'RETRIED';
  attemptCount: number;
  provider: 'DYNAMIC_SERVER_WALLET' | 'MOCK';
  correlationId: string;
  lastError: string | null;
  createdAt: string;
}

export interface BindingProofInfo {
  id: string;
  embeddedWalletAddr: string;
  proofHash: string;
  verifiedAt: string;
  createdAt: string;
}

// ─── Phase 2B: Safe Automation Info ─────────────────────

export interface SafeAutomationInfo {
  id: string;
  safeAddress: string;
  moduleAddress: string;
  enabled: boolean;
  signingMode: 'DYNAMIC_SERVER_WALLET' | 'EIP1271_SAFE' | 'USER_EMBEDDED_WALLET';
  activeSessionKeyId: string | null;
  sessionKeyPublicAddress: string | null;
  constraints: Record<string, unknown>;
  enableTxHash: string | null;
  enabledAt: string | null;
  disabledAt: string | null;
  createdAt: string;
}

export interface SessionKeyInfo {
  id: string;
  publicAddress: string;
  status: 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export interface WithdrawalAllowlistEntry {
  id: string;
  address: string;
  label: string | null;
  addedTxHash: string | null;
  createdAt: string;
}

export interface ModuleTxInfo {
  id: string;
  sessionKeyId: string | null;
  action: string;
  targetContract: string;
  functionSelector: string;
  notionalUsd: number | null;
  status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'BLOCKED';
  transactionHash: string | null;
  errorMessage: string | null;
  blockReason: string | null;
  createdAt: string;
}
