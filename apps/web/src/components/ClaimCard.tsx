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
    <div className="card p-4">
      <p className="font-medium text-white">{marketSlug ?? conditionId.slice(0, 12) + '...'}</p>
      <p className="mt-1 text-lg font-semibold text-[--accent-green]">{formatUsd(amount)}</p>
      <button onClick={onRedeem} disabled={isRedeeming} className="btn-success mt-3 w-full">
        {isRedeeming ? 'Redeeming...' : 'Redeem'}
      </button>
    </div>
  );
}
