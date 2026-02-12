# Documentation Verification Checklist

Items to verify against upstream documentation before production deployment.

## Polymarket CLOB Client (@polymarket/clob-client v5)

- [ ] Verify `signatureType=1` (POLY_PROXY) is correct for proxy wallets
- [ ] Verify `createOrder` params shape matches current SDK version
- [ ] Verify `postOrder` response shape for `orderID` field name
- [ ] Verify `cancelOrder` accepts order ID string directly
- [ ] Verify API key derivation via `createApiKey()` method signature
- [ ] Verify CLOB API base URL is still `https://clob.polymarket.com`

## Polymarket Builder Relayer

- [ ] Verify relayer endpoint URL (`https://relayer.polymarket.com/relay`)
- [ ] Verify relay request payload format (`type: 'PROXY'`, `transactions` array)
- [ ] Verify signature scheme (message signing vs typed data)
- [ ] Verify proxy wallet auto-deployment on first relayer tx
- [ ] Verify response shape includes `transactionHash`

## Polymarket Data API

- [ ] Verify trades endpoint: `GET /trades?maker=ADDRESS`
- [ ] Verify positions endpoint: `GET /positions?address=ADDRESS`
- [ ] Verify field names in trade/position response objects

## Polymarket Gamma API

- [ ] Verify leaderboard endpoint: `GET /leaderboard?window=all&limit=50`
- [ ] Verify search endpoint: `GET /search?query=QUERY&type=user`
- [ ] Verify response field names match expectations

## Dynamic.xyz

- [ ] Verify JWT issuer is `app.dynamic.xyz`
- [ ] Verify RSA public key format (SPKI vs PKCS1)
- [ ] Verify JWT payload includes `verified_credentials` array
- [ ] Verify embedded wallet private key export is NOT required (using separate trading EOA)

## Smart Contracts (Polygon)

- [ ] Verify CTF Exchange address: `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`
- [ ] Verify NegRisk CTF Exchange address: `0xC5d563A36AE78145C45a50134d48A1215220f80a`
- [ ] Verify USDC address: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- [ ] Verify Conditional Tokens address: `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`
- [ ] Verify `redeemPositions` function signature and index sets `[1, 2]`

## Proxy Wallet Derivation

- [ ] Verify CREATE2 derivation mechanism from trading EOA
- [ ] Document exact factory contract and salt used
- [ ] Test proxy address derivation matches on-chain

## Rate Limits

- [ ] Document Polymarket CLOB API rate limits
- [ ] Document Gamma API rate limits
- [ ] Document Relayer rate limits
- [ ] Ensure worker poll intervals respect rate limits
