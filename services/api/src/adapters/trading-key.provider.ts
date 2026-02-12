import { Wallet } from 'ethers';
import { encryptPrivateKey, decryptPrivateKey } from '@mirrormarkets/shared';
import { getConfig } from '../config.js';

export class TradingKeyProvider {
  generateKeyPair(): { address: string; encryptedPrivateKey: string } {
    const wallet = Wallet.createRandom();
    const config = getConfig();
    const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, config.TRADING_KEY_ENCRYPTION_KEY);
    return {
      address: wallet.address,
      encryptedPrivateKey,
    };
  }

  getWallet(encryptedPrivateKey: string): Wallet {
    const config = getConfig();
    const privateKey = decryptPrivateKey(encryptedPrivateKey, config.TRADING_KEY_ENCRYPTION_KEY);
    return new Wallet(privateKey);
  }

  deriveProxyAddress(tradingAddress: string): string {
    // Polymarket proxy wallet is deterministically derived via CREATE2
    // from the trading EOA address. The exact derivation uses the
    // Polymarket proxy factory contract. For now we use a placeholder
    // that will be replaced with actual proxy address after first relayer tx.
    return tradingAddress; // Will be overwritten with actual proxy address
  }
}
