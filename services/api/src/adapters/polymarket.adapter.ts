import { ClobClient } from '@polymarket/clob-client';
import { Side, AssetType } from '@polymarket/clob-client/dist/types.js';
import { getConfig } from '../config.js';
import { SIGNATURE_TYPE, POLYGON_CHAIN_ID } from '@mirrormarkets/shared';
import { ethers } from 'ethers';

export interface PolymarketApiCredentials {
  key: string;
  secret: string;
  passphrase: string;
}

export interface CreateOrderParams {
  tokenId: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
}

export class PolymarketAdapter {
  private client: ClobClient;

  constructor(
    private tradingWallet: ethers.Wallet,
    private proxyAddress: string,
    private credentials: PolymarketApiCredentials,
  ) {
    const config = getConfig();
    this.client = new ClobClient(
      config.POLYMARKET_CLOB_API_URL,
      POLYGON_CHAIN_ID,
      tradingWallet as any, // ethers v6 Wallet -> v5 compat via any
      credentials,
      SIGNATURE_TYPE.POLY_PROXY,
      proxyAddress,
    );
  }

  async deriveApiKey(): Promise<PolymarketApiCredentials> {
    const creds = await this.client.createApiKey();
    return {
      key: creds.key,
      secret: creds.secret,
      passphrase: creds.passphrase,
    };
  }

  async createOrder(params: CreateOrderParams): Promise<any> {
    const order = await this.client.createOrder({
      tokenID: params.tokenId,
      side: params.side === 'BUY' ? Side.BUY : Side.SELL,
      size: params.size,
      price: params.price,
    });
    return this.client.postOrder(order);
  }

  async cancelOrder(orderId: string): Promise<any> {
    return this.client.cancelOrder({ orderID: orderId });
  }

  async getOpenOrders(): Promise<any> {
    return this.client.getOpenOrders();
  }

  async getOrderBook(tokenId: string): Promise<any> {
    return this.client.getOrderBook(tokenId);
  }

  async getBalanceAllowance(tokenId: string): Promise<any> {
    return this.client.getBalanceAllowance({ asset_type: AssetType.CONDITIONAL, token_id: tokenId });
  }

  static async fetchLeaderboard(): Promise<any[]> {
    const config = getConfig();
    const res = await fetch(`${config.POLYMARKET_GAMMA_API_URL}/leaderboard?window=all&limit=50`);
    if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`);
    return res.json() as Promise<any[]>;
  }

  static async fetchUserTrades(address: string, limit = 50): Promise<any[]> {
    const config = getConfig();
    const res = await fetch(
      `${config.POLYMARKET_DATA_API_URL}/trades?maker=${address}&limit=${limit}`,
    );
    if (!res.ok) throw new Error(`Trades fetch failed: ${res.status}`);
    return res.json() as Promise<any[]>;
  }

  static async searchUsers(query: string): Promise<any[]> {
    const config = getConfig();
    const res = await fetch(`${config.POLYMARKET_GAMMA_API_URL}/search?query=${encodeURIComponent(query)}&type=user`);
    if (!res.ok) throw new Error(`User search failed: ${res.status}`);
    return res.json() as Promise<any[]>;
  }
}
