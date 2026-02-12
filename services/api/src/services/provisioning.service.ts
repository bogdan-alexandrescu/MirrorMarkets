import { PrismaClient } from '@prisma/client';
import { TradingKeyProvider } from '../adapters/trading-key.provider.js';
import { PolymarketAdapter } from '../adapters/polymarket.adapter.js';
import { AuditService } from './audit.service.js';
import type { ProvisioningStatus } from '@mirrormarkets/shared';

export class ProvisioningService {
  private keyProvider = new TradingKeyProvider();

  constructor(
    private prisma: PrismaClient,
    private audit: AuditService,
  ) {}

  async getStatus(userId: string): Promise<ProvisioningStatus> {
    const [wallets, creds, copyProfile] = await Promise.all([
      this.prisma.wallet.findMany({ where: { userId } }),
      this.prisma.polymarketCredentials.findUnique({ where: { userId } }),
      this.prisma.copyProfile.findUnique({ where: { userId } }),
    ]);

    const walletTypes = new Set(wallets.map((w) => w.type));

    const status: ProvisioningStatus = {
      dynamicEoa: walletTypes.has('DYNAMIC_EOA'),
      tradingEoa: walletTypes.has('TRADING_EOA'),
      polyProxy: walletTypes.has('POLY_PROXY'),
      clobApiKey: !!creds?.apiKey,
      copyProfile: !!copyProfile,
      complete: false,
    };

    status.complete =
      status.dynamicEoa && status.tradingEoa && status.polyProxy && status.clobApiKey && status.copyProfile;

    return status;
  }

  async provision(userId: string, dynamicEoaAddress: string, ipAddress?: string): Promise<ProvisioningStatus> {
    // Step 1: Store Dynamic EOA
    await this.prisma.wallet.upsert({
      where: { userId_type: { userId, type: 'DYNAMIC_EOA' } },
      create: { userId, type: 'DYNAMIC_EOA', address: dynamicEoaAddress },
      update: { address: dynamicEoaAddress },
    });

    // Step 2: Generate trading EOA
    const existingTrading = await this.prisma.wallet.findUnique({
      where: { userId_type: { userId, type: 'TRADING_EOA' } },
    });

    let tradingAddress: string;
    let encPrivKey: string;

    if (existingTrading) {
      tradingAddress = existingTrading.address;
      encPrivKey = existingTrading.encPrivKey!;
    } else {
      const keyPair = this.keyProvider.generateKeyPair();
      tradingAddress = keyPair.address;
      encPrivKey = keyPair.encryptedPrivateKey;

      await this.prisma.wallet.create({
        data: {
          userId,
          type: 'TRADING_EOA',
          address: tradingAddress,
          encPrivKey,
        },
      });

      await this.audit.log({
        userId,
        action: 'WALLET_PROVISIONED',
        details: { type: 'TRADING_EOA', address: tradingAddress },
        ipAddress,
      });
    }

    // Step 3: Derive CLOB API key
    const existingCreds = await this.prisma.polymarketCredentials.findUnique({
      where: { userId },
    });

    if (!existingCreds) {
      const tradingWallet = this.keyProvider.getWallet(encPrivKey);
      const adapter = new PolymarketAdapter(tradingWallet, tradingAddress, {
        key: '',
        secret: '',
        passphrase: '',
      });

      try {
        const creds = await adapter.deriveApiKey();
        await this.prisma.polymarketCredentials.create({
          data: {
            userId,
            apiKey: creds.key,
            apiSecret: creds.secret,
            passphrase: creds.passphrase,
          },
        });
      } catch (error) {
        // API key derivation may fail before proxy is deployed - continue
      }
    }

    // Step 4: Store proxy address (derived after first relayer tx)
    const existingProxy = await this.prisma.wallet.findUnique({
      where: { userId_type: { userId, type: 'POLY_PROXY' } },
    });

    if (!existingProxy) {
      const proxyAddress = this.keyProvider.deriveProxyAddress(tradingAddress);
      await this.prisma.wallet.create({
        data: { userId, type: 'POLY_PROXY', address: proxyAddress },
      });

      await this.audit.log({
        userId,
        action: 'PROXY_DEPLOYED',
        details: { address: proxyAddress },
        ipAddress,
      });
    }

    // Step 5: Create default copy profile
    await this.prisma.copyProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return this.getStatus(userId);
  }
}
