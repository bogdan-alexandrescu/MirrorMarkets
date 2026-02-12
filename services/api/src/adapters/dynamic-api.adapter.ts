import type {
  DynamicServerWalletAdapter,
  EIP712TypedData,
  TransactionRequest,
  TransactionResult,
} from '@mirrormarkets/shared';
import { AppError, ErrorCodes } from '@mirrormarkets/shared';
import { getConfig } from '../config.js';

/**
 * Dynamic.xyz REST API adapter — thin boundary layer.
 *
 * This adapter maps 1:1 to Dynamic API endpoints without business logic.
 * All retry logic, rate limiting, and circuit breaking live in the
 * TradingAuthorityProvider that wraps this adapter.
 *
 * API reference (verify against latest Dynamic docs):
 *   POST /server-wallets            → create wallet
 *   GET  /server-wallets/:id        → get wallet info
 *   POST /server-wallets/:id/sign   → sign arbitrary message
 *   POST /server-wallets/:id/sign-typed-data → sign EIP-712
 *   POST /server-wallets/:id/sign-transaction → sign + broadcast tx
 */

const DYNAMIC_API_BASE = 'https://app.dynamicauth.com/api/v0';
const REQUEST_TIMEOUT_MS = 15_000;

interface DynamicCreateWalletResponse {
  id: string;
  address: string;
  chain: string;
  name: string;
  status: string;
}

interface DynamicSignResponse {
  signature: string;
}

interface DynamicTxResponse {
  hash: string;
  status: string;
}

interface DynamicWalletResponse {
  id: string;
  address: string;
  status: string;
}

export class DynamicApiAdapter implements DynamicServerWalletAdapter {
  async createWallet(userId: string): Promise<{ walletId: string; address: string }> {
    const result = await this.callDynamic<DynamicCreateWalletResponse>(
      'server-wallets',
      'POST',
      {
        chain: 'EVM',
        name: `mirror-${userId.slice(0, 8)}`,
      },
    );
    return { walletId: result.id, address: result.address };
  }

  async signMessage(walletId: string, message: string): Promise<string> {
    const result = await this.callDynamic<DynamicSignResponse>(
      `server-wallets/${walletId}/sign`,
      'POST',
      {
        message,
        encoding: 'utf8',
        chain: 'EVM',
      },
    );
    return result.signature;
  }

  async signTypedData(walletId: string, typedData: EIP712TypedData): Promise<string> {
    const result = await this.callDynamic<DynamicSignResponse>(
      `server-wallets/${walletId}/sign-typed-data`,
      'POST',
      {
        typedData: JSON.stringify(typedData),
        chain: 'EVM',
      },
    );
    return result.signature;
  }

  async sendTransaction(walletId: string, tx: TransactionRequest): Promise<TransactionResult> {
    const result = await this.callDynamic<DynamicTxResponse>(
      `server-wallets/${walletId}/sign-transaction`,
      'POST',
      {
        transaction: {
          to: tx.to,
          data: tx.data,
          value: tx.value ?? '0',
          chainId: tx.chainId ?? 137,
        },
        chain: 'EVM',
        broadcast: true,
      },
    );
    return {
      hash: result.hash,
      status: result.status === 'confirmed' ? 'confirmed' : 'submitted',
    };
  }

  async getWallet(walletId: string): Promise<{ walletId: string; address: string; status: string }> {
    const result = await this.callDynamic<DynamicWalletResponse>(
      `server-wallets/${walletId}`,
      'GET',
    );
    return { walletId: result.id, address: result.address, status: result.status };
  }

  /**
   * Single-shot HTTP call to Dynamic API. No retry — that's handled upstream.
   * Throws on non-2xx responses with structured error info.
   */
  private async callDynamic<T>(
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const config = getConfig();
    const url = `${DYNAMIC_API_BASE}/${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.DYNAMIC_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '2', 10);
      throw new DynamicApiError('RATE_LIMITED', `Dynamic API rate limited`, 429, retryAfter);
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'unknown');
      throw new DynamicApiError(
        'API_ERROR',
        `Dynamic API ${method} ${path} failed: ${res.status} ${errorBody}`,
        res.status,
      );
    }

    return (await res.json()) as T;
  }
}

/**
 * Structured error from the Dynamic API adapter.
 * Includes HTTP status and optional retryAfter hint.
 */
export class DynamicApiError extends Error {
  constructor(
    public readonly errorType: 'RATE_LIMITED' | 'API_ERROR' | 'TIMEOUT',
    message: string,
    public readonly httpStatus: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'DynamicApiError';
  }
}
