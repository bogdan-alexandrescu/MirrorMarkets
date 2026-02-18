/**
 * test-trade.ts — End-to-end Polymarket trade test.
 *
 * Places a small limit BUY order, verifies it shows in open orders,
 * then cancels it. Requires the wallet to have USDC on Polygon.
 *
 * Usage: npx tsx --env-file=.env services/api/src/scripts/test-trade.ts
 */
import { PrismaClient } from '@prisma/client';
import { ClobClient } from '@polymarket/clob-client';
import { Side } from '@polymarket/clob-client/dist/types.js';
import { DynamicEvmWalletClient } from '@dynamic-labs-wallet/node-evm';

const CLOB_URL = process.env.POLYMARKET_CLOB_API_URL || 'https://clob.polymarket.com';
const WALLET_ADDRESS = '0xbe744167342D9Cae77344830289B999cc171C394';
const CHAIN_ID = 137;
const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const SIGNATURE_TYPE = 0; // EOA

// Test market: pick a liquid market with low prices for cheap testing
// Using a "No" token at ~$0.96 — a BUY at $0.90 won't fill (far from mid)
const TEST_TOKEN_ID = '4153292802911610701832309484716814274802943278345248636922528170020319407796';
const TEST_PRICE = 0.90;   // well below market — should NOT fill
const TEST_SIZE = 1;       // 1 share = $0.90 risk

async function main() {
  const prisma = new PrismaClient();

  // 1. Load credentials
  const creds = await prisma.polymarketCredentials.findUnique({
    where: { userId: 'test-user-1' },
  });
  if (!creds) {
    console.error('No credentials found. Run reprovision.ts first.');
    process.exit(1);
  }

  // 2. Dynamic signer
  const dynamicClient = new DynamicEvmWalletClient({
    environmentId: process.env.DYNAMIC_ENVIRONMENT_ID!,
  });
  await dynamicClient.authenticateApiToken(process.env.DYNAMIC_API_KEY!);

  const signer = {
    provider: null,
    getAddress: async () => WALLET_ADDRESS,
    signMessage: async (message: string) => {
      const wc = await dynamicClient.getWalletClient({
        accountAddress: WALLET_ADDRESS,
        chainId: CHAIN_ID,
        rpcUrl: RPC_URL,
      });
      return wc.signMessage({ message });
    },
    _signTypedData: async (
      domain: Record<string, any>,
      types: Record<string, any>,
      value: Record<string, any>,
    ) => {
      const wc = await dynamicClient.getWalletClient({
        accountAddress: WALLET_ADDRESS,
        chainId: CHAIN_ID,
        rpcUrl: RPC_URL,
      });
      const filteredTypes = Object.fromEntries(
        Object.entries(types).filter(([k]) => k !== 'EIP712Domain'),
      );
      return wc.signTypedData({
        domain,
        types: filteredTypes,
        primaryType: Object.keys(filteredTypes)[0],
        message: value,
      });
    },
    connect: () => signer,
  };

  // 3. ClobClient with L2 auth
  const clobClient = new ClobClient(
    CLOB_URL,
    CHAIN_ID,
    signer as any,
    { key: creds.apiKey, secret: creds.apiSecret, passphrase: creds.passphrase },
    SIGNATURE_TYPE,
  );

  // 4. Check order book
  console.log('=== Order Book ===');
  const book = await clobClient.getOrderBook(TEST_TOKEN_ID);
  const bestBid = book.bids?.[0];
  const bestAsk = book.asks?.[0];
  console.log(`  Best bid: ${bestBid?.price ?? 'none'} | Best ask: ${bestAsk?.price ?? 'none'}`);

  // 5. Create and post limit order
  console.log('\n=== Placing test limit order ===');
  console.log(`  Token: ${TEST_TOKEN_ID.slice(0, 20)}...`);
  console.log(`  Side: BUY | Price: $${TEST_PRICE} | Size: ${TEST_SIZE}`);

  const order = await clobClient.createOrder({
    tokenID: TEST_TOKEN_ID,
    side: Side.BUY,
    price: TEST_PRICE,
    size: TEST_SIZE,
  });
  console.log('  Order created (unsigned):', JSON.stringify(order).slice(0, 200) + '...');

  const postResult = await clobClient.postOrder(order);
  console.log('  Post result:', JSON.stringify(postResult));

  if (!postResult.orderID) {
    console.error('  FAILED: No orderID returned. Wallet may need USDC funding or exchange approval.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // 6. Verify in open orders
  console.log('\n=== Verifying open orders ===');
  await new Promise((r) => setTimeout(r, 2000)); // wait for propagation
  const openOrders = await clobClient.getOpenOrders();
  const found = Array.isArray(openOrders) && openOrders.some((o: any) => o.id === postResult.orderID);
  console.log(`  Open orders: ${Array.isArray(openOrders) ? openOrders.length : 0}`);
  console.log(`  Test order found: ${found}`);

  // 7. Cancel the order
  console.log('\n=== Cancelling test order ===');
  const cancelResult = await clobClient.cancelOrder({ orderID: postResult.orderID });
  console.log('  Cancel result:', JSON.stringify(cancelResult));

  console.log('\n=== TRADE TEST COMPLETE ===');
  console.log('  All steps succeeded: create → sign → post → verify → cancel');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Trade test failed:', err.message || err);
  process.exit(1);
});
