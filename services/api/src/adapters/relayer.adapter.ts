import { Wallet, ethers } from 'ethers';
import { POLYMARKET_CONTRACTS, POLYMARKET_URLS } from '@mirrormarkets/shared';

export class RelayerAdapter {
  constructor(
    private tradingWallet: Wallet,
    private proxyAddress: string,
  ) {}

  async approveAndDeposit(amountUsdcRaw: bigint): Promise<string> {
    // Build approve + deposit through Polymarket relayer (gasless)
    const payload = {
      type: 'PROXY',
      from: this.tradingWallet.address,
      proxy: this.proxyAddress,
      transactions: [
        {
          to: POLYMARKET_CONTRACTS.USDC,
          data: this.encodeApprove(POLYMARKET_CONTRACTS.CTF_EXCHANGE, amountUsdcRaw),
        },
      ],
    };

    const signature = await this.tradingWallet.signMessage(
      ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)))),
    );

    const res = await fetch(`${POLYMARKET_URLS.RELAYER}/relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, signature }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Relayer deposit failed: ${res.status} ${body}`);
    }

    const result = (await res.json()) as { transactionHash: string };
    return result.transactionHash;
  }

  async withdraw(amountUsdcRaw: bigint, destination: string): Promise<string> {
    const payload = {
      type: 'PROXY',
      from: this.tradingWallet.address,
      proxy: this.proxyAddress,
      transactions: [
        {
          to: POLYMARKET_CONTRACTS.USDC,
          data: this.encodeTransfer(destination, amountUsdcRaw),
        },
      ],
    };

    const signature = await this.tradingWallet.signMessage(
      ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)))),
    );

    const res = await fetch(`${POLYMARKET_URLS.RELAYER}/relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, signature }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Relayer withdrawal failed: ${res.status} ${body}`);
    }

    const result = (await res.json()) as { transactionHash: string };
    return result.transactionHash;
  }

  async redeemPositions(conditionId: string): Promise<string> {
    const iface = new ethers.Interface([
      'function redeemPositions(bytes32 conditionId, uint256[] indexSets)',
    ]);

    const data = iface.encodeFunctionData('redeemPositions', [
      conditionId,
      [1, 2], // Yes and No outcome indices
    ]);

    const payload = {
      type: 'PROXY',
      from: this.tradingWallet.address,
      proxy: this.proxyAddress,
      transactions: [
        {
          to: POLYMARKET_CONTRACTS.CONDITIONAL_TOKENS,
          data,
        },
      ],
    };

    const signature = await this.tradingWallet.signMessage(
      ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)))),
    );

    const res = await fetch(`${POLYMARKET_URLS.RELAYER}/relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, signature }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Relayer redeem failed: ${res.status} ${body}`);
    }

    const result = (await res.json()) as { transactionHash: string };
    return result.transactionHash;
  }

  private encodeApprove(spender: string, amount: bigint): string {
    const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
    return iface.encodeFunctionData('approve', [spender, amount]);
  }

  private encodeTransfer(to: string, amount: bigint): string {
    const iface = new ethers.Interface(['function transfer(address to, uint256 amount)']);
    return iface.encodeFunctionData('transfer', [to, amount]);
  }
}
