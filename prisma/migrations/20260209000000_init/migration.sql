-- Baseline migration: create all enums, tables, indexes, and foreign keys
-- from the full Prisma schema.

-- ── Enums ───────────────────────────────────────────────

CREATE TYPE "WalletType" AS ENUM ('DYNAMIC_EOA', 'TRADING_EOA', 'SERVER_WALLET', 'POLY_PROXY');
CREATE TYPE "ServerWalletStatus" AS ENUM ('CREATING', 'READY', 'FAILED');
CREATE TYPE "CopyProfileStatus" AS ENUM ('DISABLED', 'ENABLED', 'PAUSED');
CREATE TYPE "FollowStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REMOVED');
CREATE TYPE "CopyAttemptStatus" AS ENUM ('PENDING', 'SUBMITTED', 'FILLED', 'PARTIALLY_FILLED', 'FAILED', 'SKIPPED');
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "RelayerTxStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');
CREATE TYPE "RelayerTxType" AS ENUM ('APPROVE', 'DEPOSIT', 'WITHDRAW', 'REDEEM', 'MODULE_ENABLE', 'MODULE_DISABLE', 'MODULE_EXEC');
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');
CREATE TYPE "SigningRequestStatus" AS ENUM ('CREATED', 'SENT', 'SUCCEEDED', 'FAILED', 'RETRIED');
CREATE TYPE "SigningRequestType" AS ENUM ('TYPED_DATA', 'MESSAGE', 'TX');
CREATE TYPE "SigningPurpose" AS ENUM ('CLOB_ORDER', 'CLOB_CANCEL', 'CLOB_API_KEY', 'WITHDRAW', 'CTF_REDEEM', 'CTF_APPROVE', 'SAFE_MODULE_OP', 'PROVISIONING_PROOF', 'BINDING_PROOF', 'OTHER');
CREATE TYPE "SigningProvider" AS ENUM ('DYNAMIC_SERVER_WALLET', 'MOCK');
CREATE TYPE "SigningMode" AS ENUM ('DYNAMIC_SERVER_WALLET', 'EIP1271_SAFE', 'USER_EMBEDDED_WALLET');
CREATE TYPE "SessionKeyStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED');
CREATE TYPE "ModuleTxStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'BLOCKED');
CREATE TYPE "AuditAction" AS ENUM (
    'USER_CREATED', 'WALLET_PROVISIONED', 'PROXY_DEPLOYED',
    'COPY_ENABLED', 'COPY_DISABLED', 'COPY_ATTEMPT',
    'ORDER_PLACED', 'ORDER_CANCELLED',
    'FOLLOW_CREATED', 'FOLLOW_REMOVED',
    'DEPOSIT_INITIATED', 'WITHDRAWAL_INITIATED', 'WITHDRAWAL_COMPLETED',
    'CLAIM_REDEEMED', 'AUTO_CLAIM_ENABLED', 'AUTO_CLAIM_DISABLED', 'AUTO_CLAIM_RUN',
    'SETTINGS_UPDATED', 'ERROR',
    'SERVER_WALLET_CREATED', 'SERVER_WALLET_FAILED',
    'SIGNING_REQUESTED', 'SIGNING_COMPLETED', 'SIGNING_FAILED',
    'SIGN_REQUEST_SENT', 'SIGN_REQUEST_SUCCEEDED', 'SIGN_REQUEST_FAILED',
    'SIGN_RATE_LIMITED', 'SIGN_RETRY_SCHEDULED',
    'MIGRATION_STARTED', 'MIGRATION_COMPLETED', 'MIGRATION_FAILED',
    'PRIVATE_KEY_DESTROYED', 'OWNERSHIP_TRANSFERRED',
    'BINDING_PROOF_CREATED', 'BINDING_PROOF_VERIFIED',
    'MODULE_ENABLE_PREPARED', 'MODULE_ENABLE_CONFIRMED', 'MODULE_DISABLED',
    'SESSION_KEY_REGISTERED', 'SESSION_KEY_ROTATED', 'SESSION_KEY_REVOKED',
    'CONSTRAINTS_UPDATED',
    'MODULE_TX_SUBMITTED', 'MODULE_TX_CONFIRMED', 'MODULE_TX_BLOCKED',
    'WITHDRAWAL_ALLOWLIST_ADDED', 'WITHDRAWAL_ALLOWLIST_REMOVED'
);

-- ── Tables ──────────────────────────────────────────────

-- users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "dynamic_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_dynamic_id_key" ON "users"("dynamic_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- auth_sessions
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- wallets
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "WalletType" NOT NULL,
    "address" TEXT NOT NULL,
    "enc_priv_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wallets_user_id_type_key" ON "wallets"("user_id", "type");
CREATE INDEX "wallets_address_idx" ON "wallets"("address");

-- server_wallets
CREATE TABLE "server_wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dynamic_server_wallet_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ServerWalletStatus" NOT NULL DEFAULT 'CREATING',
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "server_wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "server_wallets_user_id_key" ON "server_wallets"("user_id");
CREATE UNIQUE INDEX "server_wallets_dynamic_server_wallet_id_key" ON "server_wallets"("dynamic_server_wallet_id");
CREATE INDEX "server_wallets_address_idx" ON "server_wallets"("address");

-- signing_requests
CREATE TABLE "signing_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "request_type" "SigningRequestType" NOT NULL,
    "purpose" "SigningPurpose" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload_json" JSONB,
    "status" "SigningRequestStatus" NOT NULL DEFAULT 'CREATED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "provider" "SigningProvider" NOT NULL,
    "signature" TEXT,
    "correlation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "signing_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "signing_requests_idempotency_key_key" ON "signing_requests"("idempotency_key");
CREATE INDEX "signing_requests_user_id_created_at_idx" ON "signing_requests"("user_id", "created_at");
CREATE INDEX "signing_requests_status_idx" ON "signing_requests"("status");
CREATE INDEX "signing_requests_correlation_id_idx" ON "signing_requests"("correlation_id");

-- binding_proofs
CREATE TABLE "binding_proofs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "embedded_wallet_addr" TEXT NOT NULL,
    "proof_hash" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "binding_proofs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "binding_proofs_user_id_key" ON "binding_proofs"("user_id");

-- polymarket_credentials
CREATE TABLE "polymarket_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "api_secret" TEXT NOT NULL,
    "passphrase" TEXT NOT NULL,
    "proxy_address" TEXT,
    "is_proxy_deployed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "polymarket_credentials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "polymarket_credentials_user_id_key" ON "polymarket_credentials"("user_id");

-- copy_profiles
CREATE TABLE "copy_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "CopyProfileStatus" NOT NULL DEFAULT 'DISABLED',
    "max_position_size_usd" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "max_open_positions" INTEGER NOT NULL DEFAULT 10,
    "copy_percentage" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "min_odds" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "max_odds" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "enabled_market_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blocked_market_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "copy_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "copy_profiles_user_id_key" ON "copy_profiles"("user_id");

-- leaders
CREATE TABLE "leaders" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "display_name" TEXT,
    "profile_image_url" TEXT,
    "pnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leaders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leaders_address_key" ON "leaders"("address");
CREATE INDEX "leaders_rank_idx" ON "leaders"("rank");

-- follows
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "leader_id" TEXT NOT NULL,
    "status" "FollowStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "follows_user_id_leader_id_key" ON "follows"("user_id", "leader_id");

-- leader_events
CREATE TABLE "leader_events" (
    "id" TEXT NOT NULL,
    "leader_id" TEXT NOT NULL,
    "condition_id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "market_slug" TEXT,
    "side" "OrderSide" NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "transaction_hash" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leader_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "leader_events_leader_id_detected_at_idx" ON "leader_events"("leader_id", "detected_at");
CREATE INDEX "leader_events_condition_id_idx" ON "leader_events"("condition_id");

-- copy_attempts
CREATE TABLE "copy_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "leader_event_id" TEXT NOT NULL,
    "status" "CopyAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "order_id" TEXT,
    "skip_reason" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "copy_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "copy_attempts_user_id_created_at_idx" ON "copy_attempts"("user_id", "created_at");
CREATE INDEX "copy_attempts_leader_event_id_idx" ON "copy_attempts"("leader_event_id");

-- orders
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "poly_order_id" TEXT,
    "condition_id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "market_slug" TEXT,
    "side" "OrderSide" NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "filled_size" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "orders_poly_order_id_key" ON "orders"("poly_order_id");
CREATE INDEX "orders_user_id_status_idx" ON "orders"("user_id", "status");
CREATE INDEX "orders_condition_id_idx" ON "orders"("condition_id");

-- fills
CREATE TABLE "fills" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "poly_fill_id" TEXT,
    "size" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "side" "OrderSide" NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "filled_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fills_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fills_poly_fill_id_key" ON "fills"("poly_fill_id");
CREATE INDEX "fills_order_id_idx" ON "fills"("order_id");

-- position_snapshots
CREATE TABLE "position_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "condition_id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "market_slug" TEXT,
    "size" DOUBLE PRECISION NOT NULL,
    "avg_price" DOUBLE PRECISION NOT NULL,
    "current_price" DOUBLE PRECISION NOT NULL,
    "pnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "position_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "position_snapshots_user_id_condition_id_idx" ON "position_snapshots"("user_id", "condition_id");

-- relayer_txs
CREATE TABLE "relayer_txs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "RelayerTxType" NOT NULL,
    "status" "RelayerTxStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_hash" TEXT,
    "amount" DOUBLE PRECISION,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "relayer_txs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "relayer_txs_user_id_type_idx" ON "relayer_txs"("user_id", "type");

-- withdrawals
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "destination_addr" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_hash" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "withdrawals_user_id_idx" ON "withdrawals"("user_id");

-- auto_claim_settings
CREATE TABLE "auto_claim_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "min_claimable_usd" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auto_claim_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auto_claim_settings_user_id_key" ON "auto_claim_settings"("user_id");

-- auto_claim_runs
CREATE TABLE "auto_claim_runs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "claimed_count" INTEGER NOT NULL DEFAULT 0,
    "claimed_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auto_claim_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auto_claim_runs_user_id_ran_at_idx" ON "auto_claim_runs"("user_id", "ran_at");

-- audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- idempotency_keys
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");
CREATE INDEX "idempotency_keys_key_idx" ON "idempotency_keys"("key");
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- safe_automations (Phase 2B)
CREATE TABLE "safe_automations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "safe_address" TEXT NOT NULL,
    "module_address" TEXT NOT NULL,
    "registry_address" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "signing_mode" "SigningMode" NOT NULL DEFAULT 'DYNAMIC_SERVER_WALLET',
    "active_session_key_id" TEXT,
    "session_key_public_address" TEXT,
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "enable_tx_hash" TEXT,
    "enabled_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "safe_automations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "safe_automations_user_id_key" ON "safe_automations"("user_id");
CREATE INDEX "safe_automations_safe_address_idx" ON "safe_automations"("safe_address");

-- session_keys (Phase 2B)
CREATE TABLE "session_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "public_address" TEXT NOT NULL,
    "encrypted_private_key" TEXT NOT NULL,
    "status" "SessionKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "session_keys_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "session_keys_user_id_status_idx" ON "session_keys"("user_id", "status");
CREATE INDEX "session_keys_public_address_idx" ON "session_keys"("public_address");

-- withdrawal_allowlists (Phase 2B)
CREATE TABLE "withdrawal_allowlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "added_tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "withdrawal_allowlists_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "withdrawal_allowlists_user_id_address_key" ON "withdrawal_allowlists"("user_id", "address");

-- module_txs (Phase 2B)
CREATE TABLE "module_txs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_key_id" TEXT,
    "action" TEXT NOT NULL,
    "target_contract" TEXT NOT NULL,
    "function_selector" TEXT NOT NULL,
    "call_data" TEXT NOT NULL,
    "notional_usd" DOUBLE PRECISION,
    "status" "ModuleTxStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_hash" TEXT,
    "error_message" TEXT,
    "block_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "module_txs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "module_txs_user_id_created_at_idx" ON "module_txs"("user_id", "created_at");
CREATE INDEX "module_txs_status_idx" ON "module_txs"("status");

-- ── Foreign Keys ────────────────────────────────────────

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "server_wallets" ADD CONSTRAINT "server_wallets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "binding_proofs" ADD CONSTRAINT "binding_proofs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "polymarket_credentials" ADD CONSTRAINT "polymarket_credentials_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "copy_profiles" ADD CONSTRAINT "copy_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "follows" ADD CONSTRAINT "follows_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_leader_id_fkey"
    FOREIGN KEY ("leader_id") REFERENCES "leaders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leader_events" ADD CONSTRAINT "leader_events_leader_id_fkey"
    FOREIGN KEY ("leader_id") REFERENCES "leaders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "copy_attempts" ADD CONSTRAINT "copy_attempts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copy_attempts" ADD CONSTRAINT "copy_attempts_leader_event_id_fkey"
    FOREIGN KEY ("leader_event_id") REFERENCES "leader_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copy_attempts" ADD CONSTRAINT "copy_attempts_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fills" ADD CONSTRAINT "fills_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "position_snapshots" ADD CONSTRAINT "position_snapshots_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "relayer_txs" ADD CONSTRAINT "relayer_txs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auto_claim_settings" ADD CONSTRAINT "auto_claim_settings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auto_claim_runs" ADD CONSTRAINT "auto_claim_runs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "safe_automations" ADD CONSTRAINT "safe_automations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_keys" ADD CONSTRAINT "session_keys_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "withdrawal_allowlists" ADD CONSTRAINT "withdrawal_allowlists_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "module_txs" ADD CONSTRAINT "module_txs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
