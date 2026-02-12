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
export declare class PolymarketAdapter {
    private tradingWallet;
    private proxyAddress;
    private credentials;
    private client;
    constructor(tradingWallet: ethers.Wallet, proxyAddress: string, credentials: PolymarketApiCredentials);
    deriveApiKey(): Promise<PolymarketApiCredentials>;
    createOrder(params: CreateOrderParams): Promise<any>;
    cancelOrder(orderId: string): Promise<any>;
    getOpenOrders(): Promise<any>;
    getOrderBook(tokenId: string): Promise<any>;
    getBalanceAllowance(tokenId: string): Promise<any>;
    static fetchLeaderboard(): Promise<any[]>;
    static fetchUserTrades(address: string, limit?: number): Promise<any[]>;
    static searchUsers(query: string): Promise<any[]>;
}
//# sourceMappingURL=polymarket.adapter.d.ts.map