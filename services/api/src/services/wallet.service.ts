import { PrismaClient } from '@prisma/client';
import { TradingKeyProvider } from '../adapters/trading-key.provider.js';
import { PolymarketAdapter } from '../adapters/polymarket.adapter.js';
import { RelayerAdapter } from '../adapters/relayer.adapter.js';
import { NotFoundError } from '@mirrormarkets/shared';

export class WalletService {
  private keyProvider = new TradingKeyProvider();

  constructor(private prisma: PrismaClient) {}

  async getTradingWalletAndProxy(userId: string) {
    const tradingWallet = await this.prisma.wallet.findUnique({
      where: { userId_type: { userId, type: 'TRADING_EOA' } },
    });

    const proxyWallet = await this.prisma.wallet.findUnique({
      where: { userId_type: { userId, type: 'POLY_PROXY' } },
    });

    if (!tradingWallet?.encPrivKey || !proxyWallet) {
      throw new NotFoundError('Trading wallet');
    }

    return {
      wallet: this.keyProvider.getWallet(tradingWallet.encPrivKey),
      proxyAddress: proxyWallet.address,
    };
  }

  async getPolymarketAdapter(userId: string): Promise<PolymarketAdapter> {
    const { wallet, proxyAddress } = await this.getTradingWalletAndProxy(userId);

    const creds = await this.prisma.polymarketCredentials.findUnique({
      where: { userId },
    });

    if (!creds) {
      throw new NotFoundError('Polymarket credentials');
    }

    return new PolymarketAdapter(wallet, proxyAddress, {
      key: creds.apiKey,
      secret: creds.apiSecret,
      passphrase: creds.passphrase,
    });
  }

  async getRelayerAdapter(userId: string): Promise<RelayerAdapter> {
    const { wallet, proxyAddress } = await this.getTradingWalletAndProxy(userId);
    return new RelayerAdapter(wallet, proxyAddress);
  }
}
