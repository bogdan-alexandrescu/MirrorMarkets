import { PrismaClient } from '@prisma/client';
import type { TradingAuthorityProvider, ProvisioningStatus } from '@mirrormarkets/shared';
import { AuditService } from './audit.service.js';
import { PolymarketAdapter } from '../adapters/polymarket.adapter.js';

/**
 * ProvisioningService
 *
 * Provisions a new user's wallet infrastructure:
 *   1. Store the Dynamic embedded-wallet EOA address (identity).
 *   2. Create a Dynamic Server Wallet (MPC signing authority).
 *   3. Derive Polymarket CLOB API credentials using the server wallet.
 *   4. Store the Proxy/Safe address (deployed by relayer on first tx).
 *   5. Create a default copy profile.
 *
 * Idempotent: each step is guarded by a check-before-write pattern.
 */
export class ProvisioningService {
  constructor(
    private prisma: PrismaClient,
    private audit: AuditService,
    private tradingAuthority: TradingAuthorityProvider,
  ) {}

  async getStatus(userId: string): Promise<ProvisioningStatus> {
    const [wallets, serverWallet, copyProfile, polyCreds] = await Promise.all([
      this.prisma.wallet.findMany({ where: { userId } }),
      this.prisma.serverWallet.findUnique({ where: { userId } }),
      this.prisma.copyProfile.findUnique({ where: { userId } }),
      this.prisma.polymarketCredentials.findUnique({ where: { userId } }),
    ]);

    const walletTypes = new Set(wallets.map((w) => w.type));

    // Mock wallets (from dev/test) are not real — treat them as not ready
    const isMockWallet = serverWallet?.dynamicServerWalletId?.startsWith('mock-') ?? false;

    const status: ProvisioningStatus = {
      serverWallet: walletTypes.has('SERVER_WALLET') && !isMockWallet,
      serverWalletReady: serverWallet?.status === 'READY' && !isMockWallet,
      polyProxy: walletTypes.has('POLY_PROXY') && !isMockWallet,
      clobCredentials: !!polyCreds,
      copyProfile: !!copyProfile,
      complete: false,
    };

    status.complete =
      status.serverWalletReady &&
      status.polyProxy &&
      status.clobCredentials &&
      status.copyProfile;

    return status;
  }

  async provision(userId: string, dynamicEoaAddress?: string, ipAddress?: string): Promise<ProvisioningStatus> {
    // Step 1: Store Dynamic EOA (identity wallet) — skip if email-only auth
    if (dynamicEoaAddress) {
      await this.prisma.wallet.upsert({
        where: { userId_type: { userId, type: 'DYNAMIC_EOA' } },
        create: { userId, type: 'DYNAMIC_EOA', address: dynamicEoaAddress },
        update: { address: dynamicEoaAddress },
      });
    }

    // Step 2: Create Dynamic Server Wallet
    const tradingAddress = await this.tradingAuthority.getAddress(userId);

    await this.audit.log({
      userId,
      action: 'WALLET_PROVISIONED',
      details: { type: 'SERVER_WALLET', address: tradingAddress },
      ipAddress,
    });

    // Step 3: Derive CLOB API credentials
    const existingCreds = await this.prisma.polymarketCredentials.findUnique({
      where: { userId },
    });

    if (!existingCreds) {
      const creds = await PolymarketAdapter.deriveApiKeyForUser(
        this.tradingAuthority,
        userId,
        tradingAddress,
      );

      await this.prisma.polymarketCredentials.create({
        data: {
          userId,
          apiKey: creds.key,
          apiSecret: creds.secret,
          passphrase: creds.passphrase,
          proxyAddress: tradingAddress,
          isProxyDeployed: false,
        },
      });

      await this.audit.log({
        userId,
        action: 'CLOB_CREDENTIALS_DERIVED',
        details: { proxyAddress: tradingAddress },
        ipAddress,
      });
    }

    // Step 4: Store proxy address (placeholder — relayer deploys on first tx)
    await this.prisma.wallet.upsert({
      where: { userId_type: { userId, type: 'POLY_PROXY' } },
      create: { userId, type: 'POLY_PROXY', address: tradingAddress },
      update: { address: tradingAddress },
    });

    // Step 5: Create default copy profile
    await this.prisma.copyProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return this.getStatus(userId);
  }
}
