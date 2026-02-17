'use client';

import type { PositionInfo } from '@mirrormarkets/shared';
import { formatUsd, formatPnl, formatPercentage } from '@mirrormarkets/shared';

interface Props {
  positions: PositionInfo[];
}

export function PositionTable({ positions }: Props) {
  return (
    <div className="table-wrapper">
      <table className="table-base">
        <thead className="table-head">
          <tr>
            <th className="table-th">Market</th>
            <th className="table-th-right">Size</th>
            <th className="table-th-right">Avg Price</th>
            <th className="table-th-right">Current</th>
            <th className="table-th-right">PnL</th>
          </tr>
        </thead>
        <tbody className="table-body">
          {positions.map((pos) => (
            <tr key={`${pos.conditionId}-${pos.tokenId}`} className="transition hover:bg-[--bg-surface-light]">
              <td className="table-td font-medium text-white">{pos.marketSlug ?? pos.conditionId.slice(0, 8)}</td>
              <td className="table-td text-right">{pos.size.toFixed(2)}</td>
              <td className="table-td text-right">{formatPercentage(pos.avgPrice)}</td>
              <td className="table-td text-right">{formatPercentage(pos.currentPrice)}</td>
              <td className={`table-td text-right font-medium ${pos.pnl >= 0 ? 'text-[--accent-green]' : 'text-[--accent-red]'}`}>
                {formatPnl(pos.pnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
