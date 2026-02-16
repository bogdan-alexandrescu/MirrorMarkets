import { PrismaClient } from '@prisma/client';
import type {
  TradingAuthorityProvider,
  EIP712TypedData,
  TransactionRequest,
  TransactionResult,
} from '@mirrormarkets/shared';
import { AppError, ErrorCodes } from '@mirrormarkets/shared';

const CROSSMINT_API_VERSION = '2025-06-09';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const SIGNATURE_POLL_INTERVAL_MS = 1_000;
const SIGNATURE_POLL_MAX_ATTEMPTS = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * DynamicServerWalletProvider — Worker-side.
 *
 * Uses Crossmint REST API for signing operations. Wallets are created by
 * the API service; the worker only reads existing wallets and signs.
 *
 * Signing is async: POST creates a signature request, then we poll GET
 * until status is "success" and read the outputSignature field.
 */
export class DynamicServerWalletProvider implements TradingAuthorityProvider {
  constructor(private prisma: PrismaClient) {}

  async getAddress(userId: string): Promise<string> {
    const sw = await this.prisma.serverWallet.findUnique({ where: { userId } });
    if (sw && sw.status === 'READY') return sw.address;
    throw new AppError(ErrorCodes.SERVER_WALLET_NOT_READY, 'Server wallet not ready', 503);
  }

  async signTypedData(userId: string, typedData: EIP712TypedData): Promise<string> {
    const sw = await this.requireReady(userId);
    return this.signAndPoll(sw.dynamicServerWalletId, {
      type: 'typed-data',
      params: { chain: 'polygon', typedData },
    });
  }

  async signMessage(userId: string, message: string | Uint8Array): Promise<string> {
    const sw = await this.requireReady(userId);
    const messageStr = typeof message === 'string'
      ? message
      : Buffer.from(message).toString('hex');
    return this.signAndPoll(sw.dynamicServerWalletId, {
      type: 'message',
      params: { chain: 'polygon', message: messageStr },
    });
  }

  async executeTransaction(userId: string, tx: TransactionRequest): Promise<TransactionResult> {
    const sw = await this.requireReady(userId);
    const result = await this.callCrossmint<{ txId?: string; hash?: string; status?: string }>(
      `wallets/${sw.dynamicServerWalletId}/transactions`,
      'POST',
      {
        params: {
          calls: [
            {
              to: tx.to,
              data: tx.data,
              value: tx.value ?? '0',
            },
          ],
          chain: 'polygon',
        },
      },
    );
    return {
      hash: result.txId ?? result.hash ?? '',
      status: result.status === 'confirmed' ? 'confirmed' : 'submitted',
    };
  }

  private async requireReady(userId: string) {
    const sw = await this.prisma.serverWallet.findUnique({ where: { userId } });
    if (!sw || sw.status !== 'READY') {
      throw new AppError(ErrorCodes.SERVER_WALLET_NOT_READY, 'Server wallet not ready', 503);
    }
    return sw;
  }

  /**
   * Crossmint signing is async: POST creates a request, then poll GET
   * until status is "success" and read the outputSignature field.
   */
  private async signAndPoll(walletId: string, body: unknown): Promise<string> {
    const created = await this.callCrossmint<{ id: string; status: string; outputSignature?: string }>(
      `wallets/${walletId}/signatures`,
      'POST',
      body,
    );

    if (created.status === 'success' && created.outputSignature) {
      return created.outputSignature;
    }

    for (let i = 0; i < SIGNATURE_POLL_MAX_ATTEMPTS; i++) {
      await sleep(SIGNATURE_POLL_INTERVAL_MS);

      const result = await this.callCrossmint<{ status: string; outputSignature?: string }>(
        `wallets/${walletId}/signatures/${created.id}`,
        'GET',
      );

      if (result.status === 'success' && result.outputSignature) {
        return result.outputSignature;
      }

      if (result.status === 'failed') {
        throw new AppError(
          ErrorCodes.SIGNING_UNAVAILABLE,
          `Crossmint signature ${created.id} failed`,
          503,
        );
      }
    }

    throw new AppError(
      ErrorCodes.SIGNING_UNAVAILABLE,
      `Crossmint signature ${created.id} timed out`,
      504,
    );
  }

  private async callCrossmint<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
    const apiKey = process.env.CROSSMINT_API_KEY ?? '';
    const baseUrl = process.env.CROSSMINT_BASE_URL ?? 'https://www.crossmint.com/api';
    const url = `${baseUrl}/${CROSSMINT_API_VERSION}/${path}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(30_000),
        });

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') ?? '2', 10);
          if (attempt < MAX_RETRIES) {
            await sleep(retryAfter * 1000);
            continue;
          }
          throw new AppError(ErrorCodes.RATE_LIMITED, 'Crossmint API rate limited', 429);
        }

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`Crossmint API ${method} ${path}: ${res.status} ${errorBody}`);
        }

        return (await res.json()) as T;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw error;
      }
    }

    throw new Error('Exhausted retries for Crossmint API');
  }
}
