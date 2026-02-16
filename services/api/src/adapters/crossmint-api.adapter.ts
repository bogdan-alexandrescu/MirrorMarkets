import type {
  DynamicServerWalletAdapter,
  EIP712TypedData,
  TransactionRequest,
  TransactionResult,
} from '@mirrormarkets/shared';

const API_VERSION = '2025-06-09';

/**
 * CrossmintApiAdapter — Crossmint REST API adapter for server-side MPC wallets.
 *
 * Implements the same DynamicServerWalletAdapter interface so it can be
 * dropped into DynamicServerWalletProvider as a replacement for the
 * Dynamic Node SDK adapter.
 *
 * Uses pure fetch() — no SDK dependency.
 */
export class CrossmintApiAdapter implements DynamicServerWalletAdapter {
  constructor(
    private apiKey: string,
    private baseUrl = 'https://api.crossmint.com',
  ) {}

  async createWallet(userId: string): Promise<{ walletId: string; address: string }> {
    const data = await this.request<{ id: string; address: string }>('POST', '/wallets', {
      type: 'evm-mpc-wallet',
      config: { signer: { type: 'api-key' } },
      linkedUser: `mirrormarkets:${userId}`,
    });

    return { walletId: data.id, address: data.address };
  }

  async getWallet(walletId: string): Promise<{ walletId: string; address: string; status: string }> {
    const data = await this.request<{ id: string; address: string; status?: string }>(
      'GET',
      `/wallets/${walletId}`,
    );

    return {
      walletId: data.id,
      address: data.address,
      status: data.status ?? 'active',
    };
  }

  async signMessage(walletId: string, message: string): Promise<string> {
    const data = await this.request<{ signature: string }>(
      'POST',
      `/wallets/${walletId}/signatures`,
      {
        type: 'evm-message',
        params: { message },
      },
    );

    return data.signature;
  }

  async signTypedData(walletId: string, typedData: EIP712TypedData): Promise<string> {
    const data = await this.request<{ signature: string }>(
      'POST',
      `/wallets/${walletId}/signatures`,
      {
        type: 'evm-typed-data',
        params: { typedData },
      },
    );

    return data.signature;
  }

  async sendTransaction(walletId: string, tx: TransactionRequest): Promise<TransactionResult> {
    const data = await this.request<{ txId?: string; hash?: string; status?: string }>(
      'POST',
      `/wallets/${walletId}/transactions`,
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
      hash: data.txId ?? data.hash ?? '',
      status: data.status === 'confirmed' ? 'confirmed' : 'submitted',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/${API_VERSION}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new CrossmintApiError(
        res.status === 429 ? 'RATE_LIMITED' : 'API_ERROR',
        `Crossmint API ${method} ${path}: ${res.status} ${errorBody}`,
        res.status,
        res.status === 429
          ? parseInt(res.headers.get('Retry-After') ?? '2', 10)
          : undefined,
      );
    }

    return (await res.json()) as T;
  }
}

/**
 * Structured error from the Crossmint API adapter.
 */
export class CrossmintApiError extends Error {
  constructor(
    public readonly errorType: 'RATE_LIMITED' | 'API_ERROR' | 'TIMEOUT',
    message: string,
    public readonly httpStatus: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'CrossmintApiError';
  }
}
