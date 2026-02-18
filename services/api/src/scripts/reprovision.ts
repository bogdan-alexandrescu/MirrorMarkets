/**
 * Re-run provisioning for test-user-1.
 * Usage: npx tsx --env-file=.env services/api/src/scripts/reprovision.ts
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

    console.log('Running provisioning for test-user-1...');
    const status = await provisioning.provision('test-user-1');
    console.log('Provisioning result:', JSON.stringify(status, null, 2));

    const sw = await prisma.serverWallet.findUnique({ where: { userId: 'test-user-1' } });
    console.log('\nServerWallet:', JSON.stringify(sw, null, 2));

    const creds = await prisma.polymarketCredentials.findUnique({ where: { userId: 'test-user-1' } });
    if (creds) {
      console.log('\nPolymarketCredentials:');
      console.log(`  apiKey: ${creds.apiKey.slice(0, 16)}...`);
      console.log(`  passphrase: ${creds.passphrase.slice(0, 12)}...`);
      console.log(`  proxyAddress: ${creds.proxyAddress}`);
    } else {
      console.log('\nNo PolymarketCredentials found.');
    }
  } catch (err) {
    console.error('Provisioning failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
