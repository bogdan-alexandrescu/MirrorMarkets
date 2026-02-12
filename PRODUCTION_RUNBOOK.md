# Production Runbook

## Deployment

### Initial Setup
1. Provision PostgreSQL database
2. Provision Redis instance
3. Set all environment variables from `.env.example`
4. Configure Dynamic.xyz environment and get API key for Server Wallets
5. Run `pnpm db:push` to create database schema (includes Phase 2A `ServerWallet` table)
6. Deploy API, Workers, and Web services

### Railway Deployment
```bash
# API service
railway up --service api

# Workers service
railway up --service workers

# Web service
railway up --service web
```

### Phase 2A Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DYNAMIC_API_KEY` | Production | Dynamic.xyz API key for Server Wallet creation and signing |
| `DYNAMIC_SERVER_WALLET_ENV` | No | `sandbox` or `production` (default: `sandbox`) |
| `USE_SERVER_WALLETS` | No | `true` (default) to use Dynamic Server Wallets for new users |
| `TRADING_KEY_ENCRYPTION_KEY` | Yes | AES-256 key for encrypting Phase 2B session keys + decrypting Phase 1 legacy keys during migration |

### Phase 2B Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POLYGON_RPC_URL` | Phase 2B | Polygon RPC endpoint for module execution |
| `AUTOMATION_MODULE_ADDRESS` | Phase 2B | Deployed AutomationModule contract address |

## Monitoring

### Health Check
- `GET /health` - Basic liveness
- `GET /system/status` - Full system status including workers, external services, and Dynamic API

### System Status Fields (Phase 2A+2B)
```json
{
  "api": "healthy | degraded | down",
  "workers": { "copyTrading": "...", "autoClaim": "...", "moduleExec": "...", ... },
  "external": {
    "polymarket": "healthy | degraded | down",
    "dynamic": "healthy | degraded | down"
  },
  "dynamicApi": "healthy | degraded | down",
  "signing": {
    "circuitBreaker": "CLOSED | OPEN | HALF_OPEN",
    "rateLimiter": { "globalCount": 0, "globalLimit": 300, "activeUsers": 0 }
  },
  "signingStats": {
    "totalRequests1h": 0,
    "failedRequests1h": 0,
    "avgLatencyMs": 0,
    "circuitBreakerState": "CLOSED"
  }
}
```

### Worker Heartbeats
Workers write last-ping timestamps to Redis:
- `worker:copy-trading:last-ping`
- `worker:auto-claim:last-ping`
- `worker:health-check:last-ping`
- `worker:position-sync:last-ping`
- `worker:module-exec:last-ping` (Phase 2B)

Alert if any ping is >2 minutes stale.

### System Health Key
- `system:health` - JSON blob with latest health check results (120s TTL)

### Dynamic API Health
- Checked via `GET https://app.dynamicauth.com/api/v0/health`
- If Dynamic API is down, system status degrades to `DEGRADED`
- All signing operations will fail with `SIGNING_UNAVAILABLE`
- Copy trading auto-pauses when Dynamic API is unreachable

## Phase 2A Migration

### Pre-Migration Checklist
- [ ] `DYNAMIC_API_KEY` is set and verified (test with `GET /system/status`)
- [ ] `TRADING_KEY_ENCRYPTION_KEY` is set (needed to decrypt Phase 1 keys for ownership transfer)
- [ ] Database backup taken
- [ ] Copy trading is paused (`UPDATE copy_profiles SET status = 'PAUSED' WHERE status = 'ENABLED'`)
- [ ] No pending orders or withdrawals

### Running the Migration
```bash
# Preview (dry run) — no database changes
DYNAMIC_API_KEY=xxx DATABASE_URL=xxx TRADING_KEY_ENCRYPTION_KEY=xxx \
  npx tsx scripts/migrate-phase2a.ts --dry-run

# Production run — all users
DYNAMIC_API_KEY=xxx DATABASE_URL=xxx TRADING_KEY_ENCRYPTION_KEY=xxx \
  npx tsx scripts/migrate-phase2a.ts

# Single user migration
DYNAMIC_API_KEY=xxx DATABASE_URL=xxx TRADING_KEY_ENCRYPTION_KEY=xxx \
  npx tsx scripts/migrate-phase2a.ts --user=<userId>
```

### Migration Steps (per user)
1. **Create Server Wallet**: Calls Dynamic API to create MPC server wallet
2. **Store in DB**: Creates `ServerWallet` record with `READY` status
3. **Transfer Ownership**: Transfers proxy wallet ownership from old trading EOA to new server wallet address
4. **Destroy Private Key**: Sets `encPrivKey` to `NULL` in Wallet table
5. **Audit Log**: Records `MIGRATION_STARTED`, `SERVER_WALLET_CREATED`, `OWNERSHIP_TRANSFERRED`, `PRIVATE_KEY_DESTROYED`, `MIGRATION_COMPLETED`

### Post-Migration Verification
```sql
-- Verify all users have server wallets
SELECT u.id, u.email, sw.address, sw.status
FROM users u
LEFT JOIN server_wallets sw ON u.id = sw.user_id
WHERE u.id IN (SELECT DISTINCT user_id FROM wallets WHERE type = 'TRADING_EOA');

-- Verify no remaining encrypted private keys
SELECT COUNT(*) FROM wallets WHERE enc_priv_key IS NOT NULL;

-- Check for failed migrations
SELECT * FROM audit_logs WHERE action = 'MIGRATION_STARTED'
  AND user_id NOT IN (SELECT user_id FROM audit_logs WHERE action = 'MIGRATION_COMPLETED');
```

### Rollback
The migration script is idempotent — re-running skips already-migrated users. However, if a server wallet was created but ownership transfer failed:
1. The old trading EOA still owns the proxy wallet (safe state)
2. `encPrivKey` was NOT yet nullified (destruction happens after transfer)
3. Re-run the migration for the specific user: `--user=<userId>`

**There is no automated rollback.** If Dynamic Server Wallet creation succeeds but ownership transfer fails, the system is in a dual-authority state. The old trading EOA retains ownership, so funds are safe. Fix the transfer issue and re-run.

## Phase 2A: Signing Infrastructure Monitoring

### Signing Rate Limiter
- Per-user limit: 30 signing requests per minute
- Global limit: 300 signing requests per minute
- Check current stats via `GET /system/status` → `signing.rateLimiter`
- If a user hits the per-user limit, they receive a `SIGNING_RATE_LIMITED` error (429)

### Signing Circuit Breaker
The circuit breaker protects against Dynamic API outages:
- **CLOSED** (normal): All requests pass through
- **OPEN** (tripped): 10+ failures in 5 minutes → all signing blocked with `SIGNING_CIRCUIT_BREAKER_OPEN` (503)
- **HALF_OPEN** (probing): After 2 minutes in OPEN, allows 3 probe requests to test recovery
- Auto-recovers to CLOSED after 3 successful probes

```sql
-- Check signing request failures in last hour
SELECT status, COUNT(*) FROM signing_requests
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;

-- Check signing request latency
SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
FROM signing_requests
WHERE status = 'SUCCEEDED'
  AND created_at > NOW() - INTERVAL '1 hour';
```

### Binding Proof Status
Users must submit a binding proof (embedded wallet signing a binding message) during onboarding. Check status:
```sql
-- Users missing binding proof
SELECT u.id, u.email FROM users u
LEFT JOIN binding_proofs bp ON u.id = bp.user_id
WHERE bp.id IS NULL
  AND u.id IN (SELECT user_id FROM server_wallets WHERE status = 'READY');
```

## Phase 2B: Safe Module Operations

### AutomationModule Deployment
Deploy the AutomationModule contract to Polygon:
```bash
cd packages/contracts
forge script script/DeployModule.s.sol:DeployModule \
  --rpc-url $POLYGON_RPC_URL \
  --broadcast \
  --verify
```

After deployment, set `AUTOMATION_MODULE_ADDRESS` in environment variables and redeploy services.

### Module Installation Flow
1. User enables automation via `POST /safe-automation/enable`
2. Backend creates `SafeAutomation` record with `moduleInstalled: false`
3. User's Safe owner signs an `enableModule` transaction
4. Backend records module installation via `POST /safe-automation/enable` with `ownerSignature`
5. Module is enabled on the Safe

### Session Key Lifecycle
```sql
-- Active session keys per user
SELECT u.email, sk.id, sk.address, sk.status, sk.expires_at
FROM session_keys sk
JOIN safe_automations sa ON sk.safe_automation_id = sa.id
JOIN users u ON sa.user_id = u.id
WHERE sk.status = 'ACTIVE'
ORDER BY sk.expires_at;

-- Expired session keys needing cleanup
SELECT * FROM session_keys
WHERE status = 'ACTIVE' AND expires_at < NOW();
```

Session key defaults:
- TTL: 7 days (configurable: 300s min, 30 days max)
- Constraints: maxNotionalPerTrade=$100, maxNotionalPerDay=$1000, maxTxPerHour=60

### Module Transaction Monitoring
```sql
-- Pending module transactions (should be empty or near-empty)
SELECT COUNT(*) FROM module_txs WHERE status = 'PENDING';

-- Failed module transactions
SELECT mt.*, u.email
FROM module_txs mt
JOIN safe_automations sa ON mt.safe_automation_id = sa.id
JOIN users u ON sa.user_id = u.id
WHERE mt.status = 'FAILED'
ORDER BY mt.created_at DESC LIMIT 20;

-- Blocked transactions (constraint violations)
SELECT mt.*, mt.error_reason
FROM module_txs mt
WHERE mt.status = 'BLOCKED'
ORDER BY mt.created_at DESC LIMIT 20;
```

### Withdrawal Allowlist
```sql
-- Check user's withdrawal allowlist
SELECT wa.address, wa.label, wa.created_at
FROM withdrawal_allowlists wa
JOIN safe_automations sa ON wa.safe_automation_id = sa.id
WHERE sa.user_id = 'USER_ID';
```

### Module Exec Worker
The module execution worker polls for pending `ModuleTx` records every 10 seconds:
- Decrypts session key from encrypted storage
- Calls `AutomationModule.executeFromSessionKey()` on Polygon
- Records transaction hash and gas used on success
- Records constraint violations as `BLOCKED` status
- Records execution failures as `FAILED` status

Monitor via `worker:module-exec:last-ping` Redis key.

## Common Operations

### Pause Copy Trading for All Users
```sql
UPDATE copy_profiles SET status = 'PAUSED' WHERE status = 'ENABLED';
```

### Resume Copy Trading
```sql
UPDATE copy_profiles SET status = 'ENABLED' WHERE status = 'PAUSED';
```

### Reconcile Stale Orders
```bash
curl -X POST https://api.mirrormarkets.xyz/admin/reconcile \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Retry Failed Relayer Transaction
```bash
curl -X POST https://api.mirrormarkets.xyz/admin/retry-relayer \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"txId": "TX_ID_HERE"}'
```

### View Recent Audit Logs
```sql
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50;
```

### View Signing Audit Logs (Phase 2A)
```sql
-- All signing requests for a user
SELECT * FROM audit_logs
WHERE user_id = 'USER_ID'
  AND action IN ('SIGNING_REQUESTED', 'SIGNING_COMPLETED', 'SIGNING_FAILED')
ORDER BY created_at DESC LIMIT 20;

-- Failed signing attempts
SELECT * FROM audit_logs
WHERE action = 'SIGNING_FAILED'
ORDER BY created_at DESC LIMIT 50;
```

### Check User's Server Wallet
```sql
SELECT sw.*, u.email
FROM server_wallets sw
JOIN users u ON sw.user_id = u.id
WHERE sw.user_id = 'USER_ID';
```

### Check User's Copy Attempts
```sql
SELECT ca.*, le.side, le.size, le.price, le.market_slug
FROM copy_attempts ca
JOIN leader_events le ON ca.leader_event_id = le.id
WHERE ca.user_id = 'USER_ID'
ORDER BY ca.created_at DESC
LIMIT 20;
```

## Incident Response

### Dynamic API Key Compromise
1. **Immediately** rotate `DYNAMIC_API_KEY` on the Dynamic.xyz dashboard
2. Redeploy all services (API + Workers) with the new key
3. All existing server wallets continue working with the new key
4. Review audit logs for suspicious signing activity:
   ```sql
   SELECT * FROM audit_logs
   WHERE action IN ('SIGNING_REQUESTED', 'SERVER_WALLET_CREATED')
     AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```
5. Enable IP allowlisting on the Dynamic dashboard to prevent future abuse

### Server Wallet Compromise (Suspected)
1. Identify affected user(s)
2. Pause copy trading for affected users:
   ```sql
   UPDATE copy_profiles SET status = 'PAUSED' WHERE user_id = 'USER_ID';
   ```
3. Mark server wallet as failed:
   ```sql
   UPDATE server_wallets SET status = 'FAILED' WHERE user_id = 'USER_ID';
   ```
4. Create new server wallet and transfer proxy ownership (use `tradingAuthority.rotate(userId)` if available, or re-run migration)
5. Record incident in audit log

### Dynamic.xyz Outage
1. System automatically enters `DEGRADED` state (visible at `GET /system/status`)
2. Copy trading auto-pauses — no new trades will be placed
3. Manual orders return `SIGNING_UNAVAILABLE` error
4. Monitor Dynamic status page
5. Recovery is automatic when Dynamic API comes back online
6. **No manual intervention needed** — the circuit breaker and retry logic handle this

### Signing Circuit Breaker Triggered
1. Check `GET /system/status` → `signing.circuitBreaker` for current state
2. If `OPEN`: Dynamic API is failing — signing is blocked for all users
3. Wait 2 minutes for automatic transition to `HALF_OPEN`
4. If Dynamic API is down, see "Dynamic.xyz Outage" above
5. If false positive, the circuit breaker auto-recovers after 3 successful probes
6. Check recent signing failures:
   ```sql
   SELECT * FROM signing_requests
   WHERE status = 'FAILED'
   ORDER BY created_at DESC LIMIT 20;
   ```

### Polymarket Circuit Breaker Triggered
1. Check `GET /system/status` for which service is degraded
2. Check API logs for error patterns
3. Polymarket circuit breaker auto-recovers after 60s
4. If persistent, check Polymarket status pages

### Worker Stopped
1. Check Redis heartbeat keys
2. Check worker container logs
3. Restart worker service
4. Verify worker resumes processing

### Failed Withdrawals
1. Query `relayer_txs` table for failed entries
2. Check Polymarket relayer status
3. Retry via admin endpoint or manual DB update
4. Verify on-chain that funds are safe

### Session Key Compromise (Phase 2B)
1. Immediately revoke the session key:
   ```bash
   curl -X DELETE https://api.mirrormarkets.xyz/safe-automation/session-keys/$SESSION_KEY_ID \
     -H "Authorization: Bearer $USER_TOKEN"
   ```
2. Or revoke directly in DB:
   ```sql
   UPDATE session_keys SET status = 'REVOKED', revoked_at = NOW()
   WHERE id = 'SESSION_KEY_ID';
   ```
3. The on-chain session key also needs revoking — the module exec worker will skip revoked keys
4. Review module transactions for suspicious activity:
   ```sql
   SELECT * FROM module_txs
   WHERE session_key_id = 'SESSION_KEY_ID'
   ORDER BY created_at DESC;
   ```
5. Register a new session key for the user if automation should continue

### Module Stuck Transactions (Phase 2B)
1. Check for stale pending transactions:
   ```sql
   SELECT * FROM module_txs
   WHERE status = 'PENDING'
     AND created_at < NOW() - INTERVAL '5 minutes';
   ```
2. Check if the module exec worker is running: `GET /system/status` → `workers.moduleExec`
3. Check worker logs for errors
4. If transactions are stuck due to nonce issues, manually update status:
   ```sql
   UPDATE module_txs SET status = 'FAILED', error_reason = 'Manual: nonce stuck'
   WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '30 minutes';
   ```

### Database Connection Issues
1. Check connection pool limits
2. Verify DATABASE_URL is correct
3. Check PostgreSQL logs
4. Consider increasing pool size in Prisma

## Backup & Recovery

### Database
- Automated daily backups via cloud provider (Railway)
- Point-in-time recovery available
- Test restore quarterly

### Encryption Keys (Phase 2A+2B)
- `DYNAMIC_API_KEY` — can be rotated on Dynamic dashboard; no data loss
- `TRADING_KEY_ENCRYPTION_KEY` — needed for Phase 2B session key encryption + Phase 1 legacy migration; **do not remove** if Phase 2B is active
- Server wallet private keys are managed by Dynamic.xyz (MPC sharded) — no backup needed on our side
- Session key private keys are AES-256-GCM encrypted in `session_keys.enc_private_key` — losing `TRADING_KEY_ENCRYPTION_KEY` means session keys become unrecoverable (but new ones can be registered)

### Key Lifecycle (Phase 2A+2B)
| Operation | How |
|-----------|-----|
| Create server wallet | `tradingAuthority.getAddress(userId)` (auto-creates on first call) |
| Rotate server wallet | `tradingAuthority.rotate(userId)` — creates new wallet, transfers proxy ownership |
| Revoke server wallet | `tradingAuthority.revoke(userId)` — marks FAILED, pauses copy trading |
| Export server wallet key | **Not possible** — MPC keys cannot be exported from Dynamic.xyz |
| Register session key | `POST /safe-automation/session-keys` — generates random key, encrypts, registers on-chain |
| Rotate session key | Revoke old key + register new key (no atomic rotation) |
| Revoke session key | `DELETE /safe-automation/session-keys/:id` — marks REVOKED in DB, should also revoke on-chain |
| Session key expiry | Worker checks `expiresAt` before each execution; expired keys are skipped |

## Scaling

### Horizontal Scaling
- API: Stateless, can run multiple instances behind load balancer
- Workers: Use BullMQ's built-in concurrency (single instance recommended to avoid duplicate processing)
- Web: Stateless Next.js, can run multiple instances

### Vertical Scaling
- Increase worker poll intervals to reduce load
- Add database read replicas for query-heavy operations
- Redis cluster for high-throughput scenarios

### Dynamic API Throughput
- Each user signing operation makes 1 HTTP call to Dynamic API
- Exponential backoff (base 1000ms, max 3 retries) for transient failures
- 429 responses respect `Retry-After` header
- Built-in rate limiter caps at 300 global signing requests/minute
- Circuit breaker trips at 10 failures in 5 minutes, recovers after 2 minutes
- If signing throughput is a bottleneck, contact Dynamic.xyz for rate limit increases
- Consider Redis-backed rate limiter for multi-instance API deployments

### Phase 2B Module Execution Throughput
- Module exec worker polls every 10 seconds
- Each pending `ModuleTx` requires 1 Polygon RPC call (gas cost ~0.03 MATIC)
- Batch processing: worker handles all pending txs in sequence per poll cycle
- For higher throughput, reduce poll interval or add parallel worker instances (ensure dedup)
