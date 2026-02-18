/**
 * Test Polymarket trading connectivity end-to-end.
 * Reads CLOB credentials from DB and makes read-only API calls.
 */
import { PrismaClient } from '@prisma/client';
import { ClobClient } from '@polymarket/clob-client';
import { DynamicEvmWalletClient } from '@dynamic-labs-wallet/node-evm';

const CLOB_URL = process.env.POLYMARKET_CLOB_API_URL || 'https://clob.polymarket.com';
const WALLET_ADDRESS = '0xbe744167342D9Cae77344830289B999cc171C394';
const CHAIN_ID = 137;
const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const SIGNATURE_TYPE = 0; // EOA

async function main() {
  const prisma = new PrismaClient();

  // 1. Read credentials from DB
  const creds = await prisma.polymarketCredentials.findUnique({
    where: { userId: 'test-user-1' },
  });
  if (!creds) {
    console.error('No credentials found for test-user-1');
    process.exit(1);
  }

  console.log('=== Credentials loaded from DB ===');
  console.log(`  apiKey: ${creds.apiKey.slice(0, 16)}...`);
  console.log(`  proxyAddress: ${creds.proxyAddress}`);

  // 2. Set up Dynamic signer
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

  // 3. Create ClobClient with L2 auth (API key credentials)
  const clobClient = new ClobClient(
    CLOB_URL,
    CHAIN_ID,
    signer as any,
    { key: creds.apiKey, secret: creds.apiSecret, passphrase: creds.passphrase },
    SIGNATURE_TYPE,
  );

  // 4. Test read-only API calls
  console.log('\n=== Testing getOpenOrders() ===');
  try {
    const orders = await clobClient.getOpenOrders();
    console.log(`  Result: ${JSON.stringify(orders)}`);
    console.log(`  SUCCESS: ${Array.isArray(orders) ? orders.length : 0} open orders`);
  } catch (err: any) {
    console.log(`  ERROR: ${err.message}`);
  }

  console.log('\n=== Testing getServerTime() ===');
  try {
    const time = await clobClient.getServerTime();
    console.log(`  Result: ${time}`);
    console.log(`  SUCCESS`);
  } catch (err: any) {
    console.log(`  ERROR: ${err.message}`);
  }

  console.log('\n=== Testing getTrades() ===');
  try {
    const trades = await clobClient.getTrades();
    console.log(`  SUCCESS: ${Array.isArray(trades) ? trades.length : 0} trades`);
  } catch (err: any) {
    console.log(`  ERROR: ${err.message}`);
  }

  await prisma.$disconnect();
  console.log('\n=== All tests complete ===');
}

main().catch(console.error);
