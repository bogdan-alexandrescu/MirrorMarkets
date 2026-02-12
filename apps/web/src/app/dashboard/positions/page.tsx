'use client';

import { usePositions, useBalances } from '@/hooks/useApi';
import { PositionTable } from '@/components/PositionTable';
import { formatUsd } from '@mirrormarkets/shared';

export default function PositionsPage() {
  const { data: positions, isLoading } = usePositions();
  const { data: balances } = useBalances();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Positions</h1>
        {balances && (
          <div className="text-right">
            <p className="text-sm text-gray-500">Portfolio Value</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatUsd(balances.total)}
            </p>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading positions...</p>
      ) : positions && positions.length > 0 ? (
        <PositionTable positions={positions} />
      ) : (
        <p className="text-gray-500">No open positions.</p>
      )}
    </div>
  );
}
