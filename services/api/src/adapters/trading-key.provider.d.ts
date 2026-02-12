import { Wallet } from 'ethers';
export declare class TradingKeyProvider {
    generateKeyPair(): {
        address: string;
        encryptedPrivateKey: string;
    };
    getWallet(encryptedPrivateKey: string): Wallet;
    deriveProxyAddress(tradingAddress: string): string;
}
//# sourceMappingURL=trading-key.provider.d.ts.map