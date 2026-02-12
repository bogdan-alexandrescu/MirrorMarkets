import { ClobClient } from '@polymarket/clob-client';
import { Side, AssetType } from '@polymarket/clob-client/dist/types.js';
import { getConfig } from '../config.js';
import { SIGNATURE_TYPE, POLYGON_CHAIN_ID } from '@mirrormarkets/shared';
export class PolymarketAdapter {
    tradingWallet;
    proxyAddress;
    credentials;
    client;
    constructor(tradingWallet, proxyAddress, credentials) {
        this.tradingWallet = tradingWallet;
        this.proxyAddress = proxyAddress;
        this.credentials = credentials;
        const config = getConfig();
        this.client = new ClobClient(config.POLYMARKET_CLOB_API_URL, POLYGON_CHAIN_ID, tradingWallet, // ethers v6 Wallet -> v5 compat via any
        credentials, SIGNATURE_TYPE.POLY_PROXY, proxyAddress);
    }
    async deriveApiKey() {
        const creds = await this.client.createApiKey();
        return {
            key: creds.key,
            secret: creds.secret,
            passphrase: creds.passphrase,
        };
    }
    async createOrder(params) {
        const order = await this.client.createOrder({
            tokenID: params.tokenId,
            side: params.side === 'BUY' ? Side.BUY : Side.SELL,
            size: params.size,
            price: params.price,
        });
        return this.client.postOrder(order);
    }
    async cancelOrder(orderId) {
        return this.client.cancelOrder({ orderID: orderId });
    }
    async getOpenOrders() {
        return this.client.getOpenOrders();
    }
    async getOrderBook(tokenId) {
        return this.client.getOrderBook(tokenId);
    }
    async getBalanceAllowance(tokenId) {
        return this.client.getBalanceAllowance({ asset_type: AssetType.CONDITIONAL, token_id: tokenId });
    }
    static async fetchLeaderboard() {
        const config = getConfig();
        const res = await fetch(`${config.POLYMARKET_GAMMA_API_URL}/leaderboard?window=all&limit=50`);
        if (!res.ok)
            throw new Error(`Leaderboard fetch failed: ${res.status}`);
        return res.json();
    }
    static async fetchUserTrades(address, limit = 50) {
        const config = getConfig();
        const res = await fetch(`${config.POLYMARKET_DATA_API_URL}/trades?maker=${address}&limit=${limit}`);
        if (!res.ok)
            throw new Error(`Trades fetch failed: ${res.status}`);
        return res.json();
    }
    static async searchUsers(query) {
        const config = getConfig();
        const res = await fetch(`${config.POLYMARKET_GAMMA_API_URL}/search?query=${encodeURIComponent(query)}&type=user`);
        if (!res.ok)
            throw new Error(`User search failed: ${res.status}`);
        return res.json();
    }
}
//# sourceMappingURL=polymarket.adapter.js.map