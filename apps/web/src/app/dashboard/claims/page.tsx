'use client';

import { useClaimable, useRedeem, useAutoClaimSettings, useUpdateAutoClaim } from '@/hooks/useApi';
import { ClaimCard } from '@/components/ClaimCard';
import { formatUsd } from '@mirrormarkets/shared';

export default function ClaimsPage() {
  const { data: claimable, isLoading } = useClaimable();
  const { data: autoClaim } = useAutoClaimSettings();
  const redeem = useRedeem();
  const updateAutoClaim = useUpdateAutoClaim();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Claims</h1>

      {/* Auto-claim toggle */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Auto-Claim</p>
          <p className="text-sm text-gray-500">
            Automatically redeem resolved positions
          </p>
        </div>
        <button
          onClick={() =>
            updateAutoClaim.mutate({ enabled: !autoClaim?.enabled })
          }
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
            autoClaim?.enabled ? 'bg-brand-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition ${
              autoClaim?.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Claimable positions */}
      {isLoading ? (
        <p className="text-gray-500">Loading claimable positions...</p>
      ) : claimable && claimable.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {claimable.map((item: any) => (
            <ClaimCard
              key={item.conditionId}
              conditionId={item.conditionId}
              amount={item.amount}
              marketSlug={item.marketSlug}
              onRedeem={() => redeem.mutate(item.conditionId)}
              isRedeeming={redeem.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No claimable positions at this time.</p>
      )}
    </div>
  );
}
