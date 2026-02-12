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
  RELAYER: 'https://relayer.polymarket.com',
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
  HEALTH_CHECK_MS: 60_000,
  AUTO_CLAIM_MS: 3_600_000,
  POSITION_SYNC_MS: 300_000,
} as const;

// Circuit breaker
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
