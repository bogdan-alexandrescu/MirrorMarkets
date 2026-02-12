'use client';

import type { PositionInfo } from '@mirrormarkets/shared';
import { formatUsd, formatPnl, formatPercentage } from '@mirrormarkets/shared';

interface Props {
  positions: PositionInfo[];
}

export function PositionTable({ positions }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Market</th>
            <th className="px-4 py-2 text-right font-medium text-gray-500">Size</th>
            <th className="px-4 py-2 text-right font-medium text-gray-500">Avg Price</th>
            <th className="px-4 py-2 text-right font-medium text-gray-500">Current</th>
            <th className="px-4 py-2 text-right font-medium text-gray-500">PnL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {positions.map((pos) => (
            <tr key={`${pos.conditionId}-${pos.tokenId}`}>
              <td className="px-4 py-3">
                <span className="font-medium text-gray-900 dark:text-white">
                  {pos.marketSlug ?? pos.conditionId.slice(0, 8)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">{pos.size.toFixed(2)}</td>
              <td className="px-4 py-3 text-right">{formatPercentage(pos.avgPrice)}</td>
              <td className="px-4 py-3 text-right">{formatPercentage(pos.currentPrice)}</td>
              <td className={`px-4 py-3 text-right font-medium ${pos.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPnl(pos.pnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
