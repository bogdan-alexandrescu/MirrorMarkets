import type {
  DynamicServerWalletAdapter,
  EIP712TypedData,
  TransactionRequest,
  TransactionResult,
} from '@mirrormarkets/shared';

const API_VERSION = '2025-06-09';
const SIGNATURE_POLL_INTERVAL_MS = 1_000;
const SIGNATURE_POLL_MAX_ATTEMPTS = 30;

interface SignatureResponse {
  id: string;
  status: string;
  outputSignature?: string;
}

/**
 * CrossmintApiAdapter — Crossmint REST API adapter for server-side MPC wallets.
 *
 * Creates per-user MPC wallets (type: "mpc") that produce standard ECDSA
 * signatures compatible with Polymarket CLOB.
 *
 * Signing is async: POST creates a signature request, then we poll GET
 * until status is "success" and read outputSignature.
 *
 * Wallet identifier: the on-chain address (Crossmint uses it as the locator).
 */
export class CrossmintApiAdapter implements DynamicServerWalletAdapter {
  constructor(
    private apiKey: string,
    private baseUrl = 'https://www.crossmint.com/api',
  ) {}

  async createWallet(userId: string): Promise<{ walletId: string; address: string }> {
    const data = await this.request<{ address: string }>('POST', '/wallets', {
      chainType: 'evm',
      type: 'mpc',
      owner: `userId:${userId}`,
    });

    // Crossmint MPC wallets use address as the locator (no separate ID)
    return { walletId: data.address, address: data.address };
  }

  async getWallet(walletId: string): Promise<{ walletId: string; address: string; status: string }> {
    const data = await this.request<{ address: string; type?: string }>(
      'GET',
      `/wallets/${walletId}`,
    );

    return {
      walletId: data.address,
      address: data.address,
      status: 'active',
    };
  }

  async signMessage(walletId: string, message: string): Promise<string> {
    return this.signAndPoll(walletId, {
      type: 'message',
      params: { chain: 'polygon', message },
    });
  }

  async signTypedData(walletId: string, typedData: EIP712TypedData): Promise<string> {
    return this.signAndPoll(walletId, {
      type: 'typed-data',
      params: { chain: 'polygon', typedData },
    });
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

  /**
   * Crossmint signing is async: POST creates a request, then poll GET
   * until status is "success" and read the outputSignature field.
   */
  private async signAndPoll(walletId: string, body: unknown): Promise<string> {
    const created = await this.request<SignatureResponse>(
      'POST',
      `/wallets/${walletId}/signatures`,
      body,
    );

    if (created.status === 'success' && created.outputSignature) {
      return created.outputSignature;
    }

    // Poll for completion
    for (let i = 0; i < SIGNATURE_POLL_MAX_ATTEMPTS; i++) {
      await sleep(SIGNATURE_POLL_INTERVAL_MS);

      const result = await this.request<SignatureResponse>(
        'GET',
        `/wallets/${walletId}/signatures/${created.id}`,
      );

      if (result.status === 'success' && result.outputSignature) {
        return result.outputSignature;
      }

      if (result.status === 'failed') {
        throw new CrossmintApiError(
          'API_ERROR',
          `Crossmint signature ${created.id} failed`,
          500,
        );
      }
    }

    throw new CrossmintApiError(
      'TIMEOUT',
      `Crossmint signature ${created.id} did not complete within ${SIGNATURE_POLL_MAX_ATTEMPTS}s`,
      504,
    );
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
