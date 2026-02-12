# Mirror Markets (mirrormarkets.xyz)

Polymarket Copy Trading Platform - Follow top traders and automatically copy their trades.

## Architecture

```
mirrormarkets.xyz/
├── apps/web/           # Next.js 14 (App Router) - Frontend
├── services/api/       # Fastify TypeScript - REST API + SSE
├── services/workers/   # BullMQ workers - Copy engine, Auto-claim, Health
├── packages/shared/    # Shared types, constants, utils
├── prisma/             # Prisma schema
├── docker-compose.yml  # Postgres, Redis, API, Workers, Web
```

**Stack**: TypeScript, Next.js 14, Fastify 5, Prisma, BullMQ, Redis, PostgreSQL, Dynamic.xyz, Polymarket CLOB Client

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose (for local dev)

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy env file and configure
cp .env.example .env

# Start Postgres & Redis
docker compose up postgres redis -d

# Generate Prisma client and push schema
pnpm db:generate
pnpm db:push

# Run all services in dev mode
pnpm dev
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Web | 3000 | Next.js frontend |
| API | 3001 | Fastify REST API + SSE |
| Workers | - | Background copy engine, auto-claim, health checks |

## Key Features

- **Email Login**: Dynamic.xyz embedded wallets for seamless auth
- **Copy Trading**: Automatic trade copying with configurable guardrails
- **Guardrails**: Max position size, max open positions, copy percentage, odds range
- **Circuit Breaker**: Auto-pauses copy trading after consecutive failures
- **Deposits/Withdrawals**: Gasless via Polymarket relayer
- **Auto-Claim**: Automatic redemption of resolved positions
- **Real-time Logs**: SSE-powered daemon log streaming
- **System Health**: Worker monitoring and health checks

## Wallet Model

Each user has three wallets:
1. **Dynamic EOA** - Identity wallet from Dynamic.xyz
2. **Trading EOA** - Server-controlled wallet (encrypted private key in DB)
3. **Poly Proxy** - Polymarket proxy wallet (derived via CREATE2)

## API Endpoints

### Auth
- `POST /auth/dynamic/verify` - Verify Dynamic JWT, create session
- `POST /auth/logout` - Destroy session

### Wallets
- `POST /wallets/provision` - Full provisioning pipeline
- `GET /wallets/me` - Current user profile
- `GET /wallets/me/wallets` - User wallet addresses

### Leaders
- `GET /leaders/leaderboard` - Fetch leaderboard

### Follows
- `POST /follows` - Follow a leader
- `GET /follows` - List follows
- `DELETE /follows/:id` - Unfollow

### Copy Trading
- `PUT /copy/profile` - Update guardrails
- `POST /copy/enable` - Start copy trading
- `POST /copy/disable` - Stop copy trading
- `GET /copy/logs` - Paginated copy attempts
- `GET /copy/logs/stream` - SSE live log stream

### Orders & Fills
- `POST /orders` - Place order
- `GET /orders` - List orders
- `POST /orders/:id/cancel` - Cancel order
- `GET /fills` - List fills

### Portfolio
- `GET /portfolio/balances` - USDC + position values
- `GET /portfolio/positions` - Open positions

### Funds
- `GET /funds/deposit-address` - Proxy wallet deposit address
- `POST /funds/withdrawals` - Initiate withdrawal
- `GET /funds/withdrawals` - Withdrawal history

### Claims
- `GET /claims/claimable` - Claimable positions
- `POST /claims/redeem` - Redeem position
- `PUT /claims/auto-claim` - Toggle auto-claim
- `GET /claims/auto-claim` - Auto-claim settings

### System
- `GET /system/status` - System health
- `GET /health` - Simple health check

## Docker Deployment

```bash
docker compose up --build
```

## Testing

```bash
pnpm test
```

## Environment Variables

See `.env.example` for all required variables.

## License

Proprietary - All rights reserved.
