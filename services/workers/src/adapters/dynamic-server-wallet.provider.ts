import { PrismaClient } from '@prisma/client';
import { DynamicEvmWalletClient } from '@dynamic-labs-wallet/node-evm';
import { ThresholdSignatureScheme } from '@dynamic-labs-wallet/node';
import { polygon } from 'viem/chains';
import type {
  TradingAuthorityProvider,
  EIP712TypedData,
  TransactionRequest,
  TransactionResult,
} from '@mirrormarkets/shared';
import { AppError, ErrorCodes } from '@mirrormarkets/shared';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * DynamicServerWalletProvider — Worker-side.
 *
 * Uses Dynamic.xyz Node SDK for signing operations. Wallets are created by
 * the API service; the worker only reads existing wallets and signs.
 *
 * Key advantage: signTypedData computes the EIP-712 hash locally (via Viem)
 * before MPC signing, allowing Polymarket ClobAuthDomain which omits
 * verifyingContract.
 */
export class DynamicServerWalletProvider implements TradingAuthorityProvider {
  private evmClient: DynamicEvmWalletClient | null = null;
  private initPromise: Promise<DynamicEvmWalletClient> | null = null;

  constructor(private prisma: PrismaClient) {}

  private getClient(): Promise<DynamicEvmWalletClient> {
    if (this.evmClient) return Promise.resolve(this.evmClient);
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const environmentId = process.env.DYNAMIC_ENVIRONMENT_ID ?? '';
      const apiKey = process.env.DYNAMIC_API_KEY ?? '';
      const client = new DynamicEvmWalletClient({ environmentId });
      await client.authenticateApiToken(apiKey);
      this.evmClient = client;
      return client;
    })();

    this.initPromise.catch(() => {
      this.initPromise = null;
    });

    return this.initPromise;
  }

  async getAddress(userId: string): Promise<string> {
    const sw = await this.prisma.serverWallet.findUnique({ where: { userId } });
    if (sw && sw.status === 'READY') return sw.address;
    throw new AppError(ErrorCodes.SERVER_WALLET_NOT_READY, 'Server wallet not ready', 503);
  }

  async signTypedData(userId: string, typedData: EIP712TypedData): Promise<string> {
    const sw = await this.requireReady(userId);
    const client = await this.getClient();
    const rpcUrl = process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com';

    const walletClient = await client.getWalletClient({
      accountAddress: sw.address,
      chainId: 137,
      rpcUrl,
    });

    // Filter out EIP712Domain from types (Viem expects only custom types)
    const types = Object.fromEntries(
      Object.entries(typedData.types).filter(([k]) => k !== 'EIP712Domain'),
    );

    return walletClient.signTypedData({
      domain: typedData.domain,
      types,
      primaryType: Object.keys(types)[0],
      message: typedData.message,
    });
  }

  async signMessage(userId: string, message: string | Uint8Array): Promise<string> {
    const sw = await this.requireReady(userId);
    const client = await this.getClient();
    const rpcUrl = process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com';

    const walletClient = await client.getWalletClient({
      accountAddress: sw.address,
      chainId: 137,
      rpcUrl,
    });

    if (message instanceof Uint8Array) {
      const hex = `0x${Buffer.from(message).toString('hex')}` as `0x${string}`;
      return walletClient.signMessage({ message: { raw: hex } });
    }
    return walletClient.signMessage({ message });
  }

  async executeTransaction(userId: string, tx: TransactionRequest): Promise<TransactionResult> {
    const sw = await this.requireReady(userId);
    const client = await this.getClient();
    const rpcUrl = process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com';

    const walletClient = await client.getWalletClient({
      accountAddress: sw.address,
      chainId: tx.chainId ?? 137,
      rpcUrl,
    });

    const hash = await walletClient.sendTransaction({
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: tx.value ? BigInt(tx.value) : undefined,
      chain: polygon,
      account: sw.address as `0x${string}`,
    });

    return { hash, status: 'submitted' };
  }

  private async requireReady(userId: string) {
    const sw = await this.prisma.serverWallet.findUnique({ where: { userId } });
    if (!sw || sw.status !== 'READY') {
      throw new AppError(ErrorCodes.SERVER_WALLET_NOT_READY, 'Server wallet not ready', 503);
    }
    return sw;
  }
}
