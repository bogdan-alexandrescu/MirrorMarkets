// Polymarket contract addresses (Polygon mainnet)
export const POLYMARKET_CONTRACTS = {
  CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  CONDITIONAL_TOKENS: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
} as const;

// Polymarket API URLs
export const POLYMARKET_URLS = {
  CLOB: 'https://clob.polymarket.com',
  GAMMA: 'https://gamma-api.polymarket.com',
  DATA: 'https://data-api.polymarket.com',
  RELAYER: 'https://relayer-v2.polymarket.com',
} as const;

// Polymarket relay contracts (Polygon mainnet)
export const POLYMARKET_RELAY_CONTRACTS = {
  PROXY_FACTORY: '0xaB45c5A4B0c941a2F231C04C3f49182e1A254052',
  RELAY_HUB: '0xD216153c06E857cD7f72665E0aF1d7D82172F494',
} as const;

// Chain
export const POLYGON_CHAIN_ID = 137;

// Signature types
export const SIGNATURE_TYPE = {
  EOA: 0,
  POLY_PROXY: 1,
  POLY_GNOSIS_SAFE: 2,
} as const;

// Default guardrail values
export const DEFAULT_GUARDRAILS = {
  MAX_POSITION_SIZE_USD: 50,
  MAX_OPEN_POSITIONS: 10,
  COPY_PERCENTAGE: 100,
  MIN_ODDS: 0.05,
  MAX_ODDS: 0.95,
} as const;

// Worker intervals
export const WORKER_INTERVALS = {
  COPY_POLL_MS: 15_000,
  LEADER_SYNC_MS: 60_000,
  HEALTH_CHECK_MS: 60_000,
  AUTO_CLAIM_MS: 3_600_000,
  POSITION_SYNC_MS: 300_000,
} as const;

// Circuit breaker (copy trading)
export const CIRCUIT_BREAKER = {
  FAILURE_THRESHOLD: 5,
  RECOVERY_TIMEOUT_MS: 60_000,
  HALF_OPEN_MAX_CALLS: 2,
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// ─── Phase 2A: Signing Rate Limits ──────────────────────

export const SIGNING_RATE_LIMITS = {
  PER_USER_PER_MINUTE: 30,
  GLOBAL_PER_MINUTE: 300,
  BURST_MULTIPLIER: 2,
} as const;

// Phase 2A: Signing circuit breaker (Dynamic API failures)
export const SIGNING_CIRCUIT_BREAKER = {
  FAILURE_THRESHOLD: 10,
  WINDOW_MS: 300_000, // 5 minutes
  RECOVERY_TIMEOUT_MS: 120_000, // 2 minutes in open state
  HALF_OPEN_MAX_CALLS: 3,
} as const;

// Phase 2A: Signing request config
export const SIGNING_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1_000,
  RETRY_BACKOFF_FACTOR: 2,
  REQUEST_TIMEOUT_MS: 15_000,
} as const;

// ─── Phase 2B: Safe Module Constants ────────────────────

export const SAFE_MODULE = {
  /** Default constraints for new session key registrations */
  DEFAULT_MAX_NOTIONAL_PER_TRADE: 100,
  DEFAULT_MAX_NOTIONAL_PER_DAY: 1_000,
  DEFAULT_MAX_TX_PER_HOUR: 60,
  /** Session key lifetime: 7 days (seconds) */
  DEFAULT_SESSION_KEY_TTL: 7 * 24 * 60 * 60,
  /** Module version identifier */
  MODULE_VERSION: '1.0.0',
} as const;

// Polymarket function selectors for allowlist
export const POLYMARKET_SELECTORS = {
  /** ERC20.approve(address,uint256) */
  ERC20_APPROVE: '0x095ea7b3',
  /** CTFExchange.fillOrder(...) */
  CTF_FILL_ORDER: '0x23b872dd',
  /** ConditionalTokens.redeemPositions(...) */
  CTF_REDEEM: '0x01ffc9a7',
  /** USDC.transfer(address,uint256) */
  ERC20_TRANSFER: '0xa9059cbb',
} as const;
