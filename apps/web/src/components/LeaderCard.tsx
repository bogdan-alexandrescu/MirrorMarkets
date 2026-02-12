'use client';

import { formatUsd, formatPnl, shortenAddress } from '@mirrormarkets/shared';

interface Props {
  leader: {
    address: string;
    displayName?: string | null;
    profileImageUrl?: string | null;
    pnl?: number;
    volume?: number;
    rank?: number | null;
  };
  onFollow: () => void;
}

export function LeaderCard({ leader, onFollow }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {leader.profileImageUrl ? (
            <img
              src={leader.profileImageUrl}
              alt=""
              className="h-10 w-10 rounded-full bg-gray-100"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
              {(leader.displayName ?? leader.address)[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {leader.displayName ?? shortenAddress(leader.address)}
            </p>
            <p className="text-xs text-gray-500">{shortenAddress(leader.address)}</p>
          </div>
        </div>
        {leader.rank && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
            #{leader.rank}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-4 text-sm">
        <div>
          <span className="text-gray-500">PnL </span>
          <span className={`font-medium ${(leader.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPnl(leader.pnl ?? 0)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Volume </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatUsd(leader.volume ?? 0)}
          </span>
        </div>
      </div>

      <button
        onClick={onFollow}
        className="mt-3 w-full rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-600 transition hover:bg-brand-50 dark:hover:bg-brand-900/20"
      >
        Follow
      </button>
    </div>
  );
}
