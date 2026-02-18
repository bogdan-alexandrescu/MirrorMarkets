/**
 * TradingAuthorityProvider — abstraction for signing operations.
 *
 * The production implementation delegates to Dynamic Server Wallets
 * (MPC-backed).  A mock implementation exists for local dev and testing.
 */

export interface EIP712TypedData {
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
}

export interface TransactionRequest {
  to: string;
  data: string;
  value?: string;
  chainId?: number;
}

export interface TransactionResult {
  hash: string;
  status: 'submitted' | 'confirmed' | 'failed';
}

export interface TradingAuthorityProvider {
  /**
   * Returns the on-chain address of the trading authority (server wallet)
   * for the given user.  Creates one if it does not exist.
   */
  getAddress(userId: string): Promise<string>;

  /**
   * Signs EIP-712 typed data via the server wallet for the given user.
   * Used for Polymarket CLOB order signing.
   */
  signTypedData(userId: string, typedData: EIP712TypedData): Promise<string>;

  /**
   * Signs an arbitrary message via the server wallet for the given user.
   * Used for relayer payload signing.
   */
  signMessage(userId: string, message: string | Uint8Array): Promise<string>;

  /**
   * Optionally executes a transaction directly through the server wallet.
   * Used when the relayer needs a signed transaction broadcast.
   */
  executeTransaction?(userId: string, tx: TransactionRequest): Promise<TransactionResult>;

  /**
   * Rotates the server wallet for a user.  After rotation:
   *   - The old wallet is decommissioned
   *   - Proxy/Safe ownership is transferred to the new wallet
   *   - CLOB API credentials are re-derived
   */
  rotate?(userId: string): Promise<void>;

  /**
   * Revokes the server wallet for a user.  Used when a wallet is
   * compromised.  After revocation the user's copy trading is paused
   * and they must re-provision.
   */
  revoke?(userId: string): Promise<void>;
}

// ─── Phase 2A: Signing Request Tracking ─────────────────

export type SigningPurpose =
  | 'CLOB_ORDER'
  | 'CLOB_CANCEL'
  | 'CLOB_API_KEY'
  | 'WITHDRAW'
  | 'CTF_REDEEM'
  | 'CTF_APPROVE'
  | 'SAFE_MODULE_OP'
  | 'PROVISIONING_PROOF'
  | 'BINDING_PROOF'
  | 'OTHER';

export type SigningProvider = 'DYNAMIC_SERVER_WALLET' | 'CROSSMINT' | 'MOCK';

export interface SigningRequestInput {
  userId: string;
  requestType: 'TYPED_DATA' | 'MESSAGE' | 'TX';
  purpose: SigningPurpose;
  idempotencyKey: string;
  payloadHash: string;
  payloadJson?: unknown;
  provider: SigningProvider;
  correlationId: string;
}

export interface SigningRequestResult {
  requestId: string;
  signature: string;
  provider: SigningProvider;
  attemptCount: number;
  durationMs: number;
}

// ─── Phase 2A: Signing Rate Limits ──────────────────────

export interface SigningRateLimitConfig {
  perUserPerMinute: number;
  globalPerMinute: number;
  burstMultiplier: number;
}

// ─── Phase 2A: Dynamic Server Wallet Adapter ────────────

/**
 * DynamicServerWalletAdapter — thin adapter boundary for Dynamic.xyz API calls.
 *
 * This is the low-level interface that maps 1:1 to Dynamic API operations.
 * The TradingAuthorityProvider is the higher-level abstraction that uses this
 * adapter internally plus adds rate limiting, signing request tracking, etc.
 */
export interface DynamicServerWalletAdapter {
  createWallet(userId: string): Promise<{ walletId: string; address: string }>;
  signMessage(walletId: string, message: string): Promise<string>;
  signTypedData(walletId: string, typedData: EIP712TypedData): Promise<string>;
  sendTransaction(walletId: string, tx: TransactionRequest): Promise<TransactionResult>;
  getWallet(walletId: string): Promise<{ walletId: string; address: string; status: string }>;
}

// ─── Phase 2A: Binding Proof ────────────────────────────

export interface BindingProofData {
  embeddedWalletAddress: string;
  serverWalletAddress: string;
  nonce: string;
  timestamp: number;
  signature: string;
}

export const BINDING_MESSAGE_PREFIX = 'MirrorMarkets Wallet Binding';

export function buildBindingMessage(
  embeddedWalletAddress: string,
  serverWalletAddress: string,
  nonce: string,
  timestamp: number,
): string {
  return [
    BINDING_MESSAGE_PREFIX,
    `Embedded: ${embeddedWalletAddress}`,
    `Server: ${serverWalletAddress}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
  ].join('\n');
}

// ─── Phase 2B: Safe Module Types ────────────────────────

export type SigningMode = 'DYNAMIC_SERVER_WALLET' | 'EIP1271_SAFE' | 'USER_EMBEDDED_WALLET';

export type SessionKeyStatus = 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED';

export interface SafeConstraints {
  maxNotionalPerTrade: number;
  maxNotionalPerDay: number;
  maxTxPerHour: number;
  expiryTimestamp: number;
  allowedTargets: string[];
  allowedSelectors: string[];
  tokenAllowlist: string[];
}

export const DEFAULT_SAFE_CONSTRAINTS: SafeConstraints = {
  maxNotionalPerTrade: 100,
  maxNotionalPerDay: 1000,
  maxTxPerHour: 60,
  expiryTimestamp: 0, // 0 = no expiry (set at registration)
  allowedTargets: [],
  allowedSelectors: [],
  tokenAllowlist: [],
};

export interface SessionKeyRegistration {
  publicAddress: string;
  constraints: SafeConstraints;
  expiresAt: number; // unix timestamp
}

export interface ModuleTxRequest {
  userId: string;
  sessionKeyId: string;
  action: string;
  targetContract: string;
  functionSelector: string;
  callData: string;
  notionalUsd?: number;
}
