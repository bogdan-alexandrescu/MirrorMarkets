'use client';

import { formatUsd } from '@mirrormarkets/shared';

interface Props {
  conditionId: string;
  amount: number;
  marketSlug: string | null;
  onRedeem: () => void;
  isRedeeming: boolean;
}

export function ClaimCard({ conditionId, amount, marketSlug, onRedeem, isRedeeming }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="font-medium text-gray-900 dark:text-white">
        {marketSlug ?? conditionId.slice(0, 12) + '...'}
      </p>
      <p className="mt-1 text-lg font-semibold text-green-600">{formatUsd(amount)}</p>
      <button
        onClick={onRedeem}
        disabled={isRedeeming}
        className="mt-3 w-full rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {isRedeeming ? 'Redeeming...' : 'Redeem'}
      </button>
    </div>
  );
}
