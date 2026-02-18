/**
 * migrate-wallets.ts
 *
 * Standalone migration script: migrates all existing Crossmint ServerWallets
 * to Dynamic.xyz by deleting old records and running full provisioning.
 *
 * Usage (from repo root):
 *   npx tsx --env-file=.env services/api/src/scripts/migrate-wallets.ts
 */

import { PrismaClient } from '@prisma/client';
import { getTradingAuthorityProvider } from '../adapters/trading-authority.factory.js';
import { AuditService } from '../services/audit.service.js';
import { ProvisioningService } from '../services/provisioning.service.js';

async function main() {
  const prisma = new PrismaClient();

  try {
    const tradingAuthority = getTradingAuthorityProvider(prisma);
    const audit = new AuditService(prisma);
    const provisioning = new ProvisioningService(prisma, audit, tradingAuthority);

    const serverWallets = await prisma.serverWallet.findMany({
      where: { status: 'READY' },
    });

    console.log(`Found ${serverWallets.length} ServerWallet(s) to migrate.\n`);

    if (serverWallets.length === 0) {
      console.log('Nothing to migrate.');
      return;
    }

    for (const sw of serverWallets) {
      console.log(`--- Migrating user: ${sw.userId} ---`);
      console.log(`  Old address: ${sw.address}`);

      try {
        // 1. Delete old CLOB credentials (bound to old wallet address)
        const deletedCreds = await prisma.polymarketCredentials.deleteMany({
          where: { userId: sw.userId },
        });
        console.log(`  Deleted ${deletedCreds.count} old PolymarketCredentials`);

        // 2. Delete old ServerWallet record (so provisioning creates a new one)
        await prisma.serverWallet.delete({ where: { id: sw.id } });
        console.log(`  Deleted old ServerWallet record`);

        // 3. Run full provisioning (creates Dynamic wallet + derives CLOB creds)
        console.log(`  Running provisioning...`);
        const status = await provisioning.provision(sw.userId);

        // 4. Get the new address
        const newSw = await prisma.serverWallet.findUnique({
          where: { userId: sw.userId },
        });

        console.log(`  New address: ${newSw?.address ?? 'FAILED'}`);
        console.log(`  CLOB credentials: ${status.clobCredentials}`);
        console.log(`  Provisioning complete: ${status.complete}`);
        console.log();
      } catch (err) {
        console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
        console.log();
      }
    }

    // Summary
    const finalWallets = await prisma.serverWallet.findMany({ where: { status: 'READY' } });
    const finalCreds = await prisma.polymarketCredentials.findMany();

    console.log('=== Migration Summary ===');
    console.log(`  ServerWallets (READY): ${finalWallets.length}`);
    for (const w of finalWallets) {
      console.log(`    ${w.userId} → ${w.address}`);
    }
    console.log(`  PolymarketCredentials: ${finalCreds.length}`);
    for (const c of finalCreds) {
      console.log(`    ${c.userId} → apiKey=${c.apiKey.slice(0, 8)}... proxy=${c.proxyAddress}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
