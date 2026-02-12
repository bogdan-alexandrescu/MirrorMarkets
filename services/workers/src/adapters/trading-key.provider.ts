import { Wallet } from 'ethers';
import { encryptPrivateKey, decryptPrivateKey } from '@mirrormarkets/shared';

const ENCRYPTION_KEY = process.env.TRADING_KEY_ENCRYPTION_KEY ?? '';

export class TradingKeyProvider {
  generateKeyPair(): { address: string; encryptedPrivateKey: string } {
    const wallet = Wallet.createRandom();
    const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, ENCRYPTION_KEY);
    return { address: wallet.address, encryptedPrivateKey };
  }

  getWallet(encryptedPrivateKey: string): Wallet {
    const privateKey = decryptPrivateKey(encryptedPrivateKey, ENCRYPTION_KEY);
    return new Wallet(privateKey);
  }
}
