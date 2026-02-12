# Production Runbook

## Deployment

### Initial Setup
1. Provision PostgreSQL database
2. Provision Redis instance
3. Set all environment variables from `.env.example`
4. Generate a 64-character hex string for `TRADING_KEY_ENCRYPTION_KEY`
5. Configure Dynamic.xyz environment and get public key
6. Run `pnpm db:push` to create database schema
7. Deploy API, Workers, and Web services

### Railway Deployment
```bash
# API service
railway up --service api

# Workers service
railway up --service workers

# Web service
railway up --service web
```

## Monitoring

### Health Check
- `GET /health` - Basic liveness
- `GET /system/status` - Full system status including workers and external services

### Worker Heartbeats
Workers write last-ping timestamps to Redis:
- `worker:copy-trading:last-ping`
- `worker:auto-claim:last-ping`
- `worker:health-check:last-ping`
- `worker:position-sync:last-ping`

Alert if any ping is >2 minutes stale.

### System Health Key
- `system:health` - JSON blob with latest health check results (120s TTL)

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

### Circuit Breaker Triggered
1. Check `GET /system/status` for which service is degraded
2. Check API logs for error patterns
3. If Polymarket API is down, wait for recovery (circuit breaker auto-recovers after 60s)
4. If persistent, check Polymarket status page

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

### Database Connection Issues
1. Check connection pool limits
2. Verify DATABASE_URL is correct
3. Check PostgreSQL logs
4. Consider increasing pool size in Prisma

## Backup & Recovery

### Database
- Automated daily backups via cloud provider
- Point-in-time recovery available
- Test restore quarterly

### Encryption Keys
- `TRADING_KEY_ENCRYPTION_KEY` is critical - losing it means losing access to all trading wallets
- Store securely in vault/KMS
- Keep offline backup

## Scaling

### Horizontal Scaling
- API: Stateless, can run multiple instances behind load balancer
- Workers: Use BullMQ's built-in concurrency (single instance recommended to avoid duplicate processing)
- Web: Stateless Next.js, can run multiple instances

### Vertical Scaling
- Increase worker poll intervals to reduce load
- Add database read replicas for query-heavy operations
- Redis cluster for high-throughput scenarios
