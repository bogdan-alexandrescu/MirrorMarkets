'use client';

import { useMe, useMyWallets, useProvisioningStatus } from '@/hooks/useApi';
import { shortenAddress } from '@mirrormarkets/shared';

export default function SettingsPage() {
  const { data: user } = useMe();
  const { data: wallets } = useMyWallets();
  const { data: provisioning } = useProvisioningStatus();

  return (
    <div className="space-y-6">
      <h1 className="page-title">Settings</h1>

      {/* Profile */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Profile</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-[--text-secondary]">Email</dt>
            <dd className="text-[--text-primary]">{user?.email ?? '--'}</dd>
          </div>
          <div>
            <dt className="text-sm text-[--text-secondary]">User ID</dt>
            <dd className="font-mono text-xs text-[--text-muted]">{user?.id ?? '--'}</dd>
          </div>
        </dl>
      </div>

      {/* Wallets */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Wallets</h2>
        <div className="space-y-3">
          {wallets?.map((w) => (
            <div key={w.type} className="flex items-center justify-between">
              <span className="text-sm font-medium text-[--text-secondary]">
                {w.type.replace(/_/g, ' ')}
              </span>
              <span className="font-mono text-xs text-[--text-muted]">
                {shortenAddress(w.address, 6)}
              </span>
            </div>
          ))}
          {(!wallets || wallets.length === 0) && (
            <p className="text-sm text-[--text-muted]">No wallets provisioned.</p>
          )}
        </div>
      </div>

      {/* Provisioning Status */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Account Status</h2>
        {provisioning ? (
          <div className="space-y-2">
            {([
              ['serverWallet', 'Signing Wallet'],
              ['polyProxy', 'Trading Wallet'],
              ['copyProfile', 'Copy Profile'],
              ['complete', 'Ready to Trade'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-[--text-secondary]">{label}</span>
                <span className={`text-sm font-medium ${provisioning[key] ? 'text-[--accent-green]' : 'text-[--accent-gold]'}`}>
                  {provisioning[key] ? 'Ready' : 'Setting up...'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[--text-muted]">Loading...</p>
        )}
      </div>
    </div>
  );
}
