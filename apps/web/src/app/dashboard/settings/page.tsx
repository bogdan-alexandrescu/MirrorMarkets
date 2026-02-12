'use client';

import { useMe, useMyWallets, useProvisioningStatus } from '@/hooks/useApi';
import { shortenAddress } from '@mirrormarkets/shared';

export default function SettingsPage() {
  const { data: user } = useMe();
  const { data: wallets } = useMyWallets();
  const { data: provisioning } = useProvisioningStatus();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Profile */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Profile</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-gray-500">Email</dt>
            <dd className="text-gray-900 dark:text-white">{user?.email ?? '--'}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">User ID</dt>
            <dd className="font-mono text-xs text-gray-600 dark:text-gray-400">{user?.id ?? '--'}</dd>
          </div>
        </dl>
      </div>

      {/* Wallets */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Wallets</h2>
        <div className="space-y-3">
          {wallets?.map((w) => (
            <div key={w.type} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {w.type.replace(/_/g, ' ')}
              </span>
              <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                {shortenAddress(w.address, 6)}
              </span>
            </div>
          ))}
          {(!wallets || wallets.length === 0) && (
            <p className="text-sm text-gray-500">No wallets provisioned.</p>
          )}
        </div>
      </div>

      {/* Provisioning Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Provisioning Status
        </h2>
        {provisioning ? (
          <div className="space-y-2">
            {Object.entries(provisioning).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{key}</span>
                <span className={`text-sm font-medium ${value ? 'text-green-600' : 'text-gray-400'}`}>
                  {value ? 'Done' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading...</p>
        )}
      </div>
    </div>
  );
}
