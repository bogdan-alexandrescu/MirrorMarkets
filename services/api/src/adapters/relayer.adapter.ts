import { createHmac } from 'node:crypto';
import { Interface, solidityPackedKeccak256, solidityPacked, concat, hexlify, getBytes, zeroPadValue, toBeHex, keccak256, getCreate2Address } from 'ethers';
import type { TradingAuthorityProvider } from '@mirrormarkets/shared';
import { POLYMARKET_CONTRACTS, POLYMARKET_RELAY_CONTRACTS } from '@mirrormarkets/shared';

const DEFAULT_GAS_LIMIT = '10000000';

/** Derive the Polymarket proxy wallet address via CREATE2 */
export function deriveProxyWallet(eoaAddress: string): string {
  const salt = keccak256(solidityPacked(['address'], [eoaAddress]));
  return getCreate2Address(
    POLYMARKET_RELAY_CONTRACTS.PROXY_FACTORY,
    salt,
    POLYMARKET_RELAY_CONTRACTS.PROXY_INIT_CODE_HASH,
  );
}

// Builder auth credentials (from env)
function getBuilderCreds() {
  const key = process.env.POLY_BUILDER_API_KEY ?? '';
  const secret = process.env.POLY_BUILDER_SECRET ?? '';
  const passphrase = process.env.POLY_BUILDER_PASSPHRASE ?? '';
  return key && secret && passphrase ? { key, secret, passphrase } : null;
}

function buildBuilderHeaders(method: string, path: string, body?: string): Record<string, string> {
  const creds = getBuilderCreds();
  if (!creds) return {};

  const timestamp = Math.floor(Date.now() / 1000);
  let message = `${timestamp}${method}${path}`;
  if (body !== undefined) message += body;

  const base64Secret = Buffer.from(creds.secret, 'base64');
  const sig = createHmac('sha256', base64Secret).update(message).digest('base64');
  // URL-safe base64 (keep = suffix)
  const sigUrlSafe = sig.replace(/\+/g, '-').replace(/\//g, '_');

  return {
    POLY_BUILDER_API_KEY: creds.key,
    POLY_BUILDER_PASSPHRASE: creds.passphrase,
    POLY_BUILDER_SIGNATURE: sigUrlSafe,
    POLY_BUILDER_TIMESTAMP: `${timestamp}`,
  };
}

// ProxyWalletFactory.proxy(calls) ABI for encoding batched proxy calls
const PROXY_ABI = [
  'function proxy((uint8 typeCode, address to, uint256 value, bytes data)[] calls) payable returns (bytes[])',
];

/**
 * RelayerAdapter — v2
 *
 * Submits gasless transactions via the Polymarket relayer v2.
 * Uses the proxy transaction flow:
 *   1. GET /relay-payload for nonce + relay address
 *   2. Encode transactions via ProxyWalletFactory.proxy(calls)
 *   3. Create struct hash with "rlx:" prefix
 *   4. Sign the struct hash
 *   5. POST /submit
 */
export class RelayerAdapter {
  constructor(
    private tradingAuthority: TradingAuthorityProvider,
    private userId: string,
    private tradingAddress: string,
    private proxyAddress: string,
    private relayerUrl: string = 'https://relayer-v2.polymarket.com',
  ) {}

  /**
   * Approve both CTF Exchange and NegRisk CTF Exchange to spend USDC.
   * Uses max uint256 so approval is one-time.
   */
  async approveExchange(): Promise<{ ctfTxHash: string; negRiskTxHash: string }> {
    const MAX_UINT256 = (1n << 256n) - 1n;

    // Batch both approvals in a single relayer transaction
    const txHash = await this.submitProxyTransactions([
      {
        to: POLYMARKET_CONTRACTS.USDC,
        data: this.encodeApprove(POLYMARKET_CONTRACTS.CTF_EXCHANGE, MAX_UINT256),
      },
      {
        to: POLYMARKET_CONTRACTS.USDC,
        data: this.encodeApprove(POLYMARKET_CONTRACTS.NEG_RISK_CTF_EXCHANGE, MAX_UINT256),
      },
    ]);

    return { ctfTxHash: txHash, negRiskTxHash: txHash };
  }

  async approveAndDeposit(amountUsdcRaw: bigint): Promise<string> {
    return this.submitProxyTransactions([
      {
        to: POLYMARKET_CONTRACTS.USDC,
        data: this.encodeApprove(POLYMARKET_CONTRACTS.CTF_EXCHANGE, amountUsdcRaw),
      },
    ]);
  }

  async withdraw(amountUsdcRaw: bigint, destination: string): Promise<string> {
    return this.submitProxyTransactions([
      {
        to: POLYMARKET_CONTRACTS.USDC,
        data: this.encodeTransfer(destination, amountUsdcRaw),
      },
    ]);
  }

  async redeemPositions(conditionId: string): Promise<string> {
    const iface = new Interface([
      'function redeemPositions(bytes32 conditionId, uint256[] indexSets)',
    ]);

    const data = iface.encodeFunctionData('redeemPositions', [
      conditionId,
      [1, 2],
    ]);

    return this.submitProxyTransactions([
      { to: POLYMARKET_CONTRACTS.CONDITIONAL_TOKENS, data },
    ]);
  }

  // ─── Core relay v2 flow ──────────────────────────────────

  private async submitProxyTransactions(
    calls: Array<{ to: string; data: string }>,
  ): Promise<string> {
    const from = this.tradingAddress;
    const proxyFactory = POLYMARKET_RELAY_CONTRACTS.PROXY_FACTORY;
    const relayHub = POLYMARKET_RELAY_CONTRACTS.RELAY_HUB;

    // 1. Get nonce and relay address
    const relayPayload = await this.getRelayPayload(from);

    // 2. Encode calls via ProxyWalletFactory.proxy(calls)
    const proxyIface = new Interface(PROXY_ABI);
    const encodedData = proxyIface.encodeFunctionData('proxy', [
      calls.map((c) => ({
        typeCode: 1, // CallType.Call
        to: c.to,
        value: 0n,
        data: c.data,
      })),
    ]);

    // 3. Create struct hash (rlx: prefix format)
    const relayerFee = '0';
    const gasPrice = '0';
    const gasLimit = DEFAULT_GAS_LIMIT;

    const structHash = this.createStructHash(
      from,
      proxyFactory,
      encodedData,
      relayerFee,
      gasPrice,
      gasLimit,
      relayPayload.nonce,
      relayHub,
      relayPayload.address,
    );

    // 4. Sign the struct hash (raw signature, no v-adjustment for PROXY type)
    const signature = await this.tradingAuthority.signMessage(
      this.userId,
      getBytes(structHash),
    );

    // 5. Submit to /submit (proxyWallet = CREATE2 derived, not stored POLY_PROXY)
    const derivedProxy = deriveProxyWallet(from);
    const request = {
      type: 'PROXY',
      from,
      to: proxyFactory,
      proxyWallet: derivedProxy,
      data: encodedData,
      nonce: relayPayload.nonce,
      signature,
      signatureParams: {
        gasPrice,
        gasLimit,
        relayerFee,
        relayHub,
        relay: relayPayload.address,
      },
      metadata: '',
    };

    const requestBody = JSON.stringify(request);
    const builderHeaders = buildBuilderHeaders('POST', '/submit', requestBody);

    const res = await fetch(`${this.relayerUrl}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...builderHeaders },
      body: requestBody,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Relayer submit failed: ${res.status} ${body}`);
    }

    const result = (await res.json()) as {
      transactionID: string;
      state: string;
      transactionHash: string;
    };

    // If no tx hash yet, poll for it
    if (result.transactionHash) {
      return result.transactionHash;
    }

    return this.pollForTxHash(result.transactionID);
  }

  private async getRelayPayload(
    signerAddress: string,
  ): Promise<{ address: string; nonce: string }> {
    const url = new URL(`${this.relayerUrl}/relay-payload`);
    url.searchParams.set('address', signerAddress);
    url.searchParams.set('type', 'PROXY');

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Relayer relay-payload failed: ${res.status} ${body}`);
    }

    return (await res.json()) as { address: string; nonce: string };
  }

  /**
   * Create the struct hash matching the Polymarket relay hub format:
   * keccak256(abi.encodePacked("rlx:", from, to, data, txFee, gasPrice, gasLimit, nonce, relayHub, relay))
   */
  private createStructHash(
    from: string,
    to: string,
    data: string,
    txFee: string,
    gasPrice: string,
    gasLimit: string,
    nonce: string,
    relayHubAddress: string,
    relayAddress: string,
  ): string {
    // Pack: "rlx:" prefix + addresses (20 bytes each) + data + uint256 fields + addresses
    const packed = concat([
      new Uint8Array([0x72, 0x6c, 0x78, 0x3a]), // "rlx:"
      from as string,
      to as string,
      data as string,
      zeroPadValue(toBeHex(BigInt(txFee)), 32),
      zeroPadValue(toBeHex(BigInt(gasPrice)), 32),
      zeroPadValue(toBeHex(BigInt(gasLimit)), 32),
      zeroPadValue(toBeHex(BigInt(nonce)), 32),
      relayHubAddress as string,
      relayAddress as string,
    ]);

    return solidityPackedKeccak256(['bytes'], [packed]);
  }

  private async pollForTxHash(
    transactionId: string,
    maxPolls = 15,
    intervalMs = 2000,
  ): Promise<string> {
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));

      const url = new URL(`${this.relayerUrl}/transaction`);
      url.searchParams.set('id', transactionId);

      const res = await fetch(url.toString());
      if (!res.ok) continue;

      const txns = (await res.json()) as Array<{
        transactionHash: string;
        state: string;
      }>;

      if (txns.length > 0 && txns[0].transactionHash) {
        if (txns[0].state === 'STATE_FAILED') {
          throw new Error(`Relayer transaction failed: ${transactionId}`);
        }
        return txns[0].transactionHash;
      }
    }

    throw new Error(`Relayer transaction timed out: ${transactionId}`);
  }

  private encodeApprove(spender: string, amount: bigint): string {
    const iface = new Interface(['function approve(address spender, uint256 amount)']);
    return iface.encodeFunctionData('approve', [spender, amount]);
  }

  private encodeTransfer(to: string, amount: bigint): string {
    const iface = new Interface(['function transfer(address to, uint256 amount)']);
    return iface.encodeFunctionData('transfer', [to, amount]);
  }
}
