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
  isFollowing?: boolean;
  onFollow: () => void;
  onUnfollow?: () => void;
  isPending?: boolean;
}

export function LeaderCard({ leader, isFollowing, onFollow, onUnfollow, isPending }: Props) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {leader.profileImageUrl ? (
            <img src={leader.profileImageUrl} alt="" className="h-10 w-10 rounded-full bg-[--bg-surface-light]" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-400">
              {(leader.displayName ?? leader.address)[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-white">
              {leader.displayName ?? shortenAddress(leader.address)}
            </p>
            <p className="text-xs text-[--text-muted]">{shortenAddress(leader.address)}</p>
          </div>
        </div>
        {leader.rank && (
          <span className="badge-warning">#{leader.rank}</span>
        )}
      </div>

      <div className="mt-3 flex gap-4 text-sm">
        <div>
          <span className="text-[--text-muted]">PnL </span>
          <span className={`font-medium ${(leader.pnl ?? 0) >= 0 ? 'text-[--accent-green]' : 'text-[--accent-red]'}`}>
            {formatPnl(leader.pnl ?? 0)}
          </span>
        </div>
        <div>
          <span className="text-[--text-muted]">Volume </span>
          <span className="font-medium text-white">{formatUsd(leader.volume ?? 0)}</span>
        </div>
      </div>

      {isFollowing ? (
        <button
          onClick={onUnfollow}
          disabled={isPending}
          className="mt-3 w-full rounded-lg border border-[--accent-red]/30 px-3 py-2 text-sm font-medium text-[--accent-red] transition hover:bg-[--accent-red]/10 disabled:opacity-50"
        >
          {isPending ? 'Unfollowing...' : 'Unfollow'}
        </button>
      ) : (
        <button
          onClick={onFollow}
          disabled={isPending}
          className="btn-primary mt-3 w-full"
        >
          {isPending ? 'Following...' : 'Follow'}
        </button>
      )}
    </div>
  );
}
