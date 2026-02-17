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
        <h1 className="page-title">Positions</h1>
        {balances && (
          <div className="text-right">
            <p className="text-sm text-[--text-secondary]">Portfolio Value</p>
            <p className="text-lg font-semibold text-[--text-primary]">
              {formatUsd(balances.total)}
            </p>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-[--text-muted]">Loading positions...</p>
      ) : positions && positions.length > 0 ? (
        <PositionTable positions={positions} />
      ) : (
        <p className="text-[--text-muted]">No open positions.</p>
      )}
    </div>
  );
}
