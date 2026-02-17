'use client';

import Link from 'next/link';
import { useFollows, useRemoveFollow } from '@/hooks/useApi';
import { shortenAddress, formatUsd, formatPnl } from '@mirrormarkets/shared';

export default function FollowingPage() {
  const { data: follows, isLoading, error } = useFollows();
  const removeFollow = useRemoveFollow();

  return (
    <div className="space-y-6">
      <h1 className="page-title">Following</h1>

      {isLoading ? (
        <p className="text-[--text-muted]">Loading...</p>
      ) : error ? (
        <div className="card border-[--accent-red]/30 bg-[--accent-red]/10 p-4">
          <p className="text-sm text-[--accent-red]">
            Failed to load follows. {error.message}
          </p>
        </div>
      ) : follows && follows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {follows.map((follow) => (
            <div key={follow.id} className="card p-4">
              <Link
                href={`/dashboard/following/${follow.leader.address}`}
                className="block transition hover:opacity-80"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {follow.leader.profileImageUrl ? (
                      <img
                        src={follow.leader.profileImageUrl}
                        alt=""
                        className="h-10 w-10 rounded-full bg-[--bg-surface-lighter]"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-400">
                        {(follow.leader.displayName ?? follow.leader.address)[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-[--text-primary]">
                        {follow.leader.displayName ?? shortenAddress(follow.leader.address)}
                      </p>
                      <p className="text-xs text-[--text-muted]">{shortenAddress(follow.leader.address)}</p>
                    </div>
                  </div>
                  {follow.leader.rank && (
                    <span className="badge-warning">#{follow.leader.rank}</span>
                  )}
                </div>

                <div className="mt-3 flex gap-4 text-sm">
                  <div>
                    <span className="text-[--text-secondary]">PnL </span>
                    <span className={`font-medium ${(follow.leader.pnl ?? 0) >= 0 ? 'text-[--accent-green]' : 'text-[--accent-red]'}`}>
                      {formatPnl(follow.leader.pnl ?? 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[--text-secondary]">Volume </span>
                    <span className="font-medium text-[--text-primary]">
                      {formatUsd(follow.leader.volume ?? 0)}
                    </span>
                  </div>
                </div>
              </Link>

              <div className="mt-3 flex items-center justify-between">
                <span
                  className={
                    follow.status === 'ACTIVE'
                      ? 'badge-success'
                      : follow.status === 'PAUSED'
                        ? 'badge-warning'
                        : 'badge-neutral'
                  }
                >
                  {follow.status}
                </span>
                <button
                  onClick={() => removeFollow.mutate(follow.id)}
                  disabled={removeFollow.isPending}
                  className="rounded px-3 py-1 text-xs font-medium text-[--accent-red] transition hover:bg-[--accent-red]/10 disabled:opacity-50"
                >
                  {removeFollow.isPending ? 'Unfollowing...' : 'Unfollow'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-[--text-muted]">
            You&apos;re not following anyone yet. Visit the{' '}
            <Link href="/dashboard/leaderboard" className="text-brand-400 hover:underline">
              Leaderboard
            </Link>{' '}
            to find traders.
          </p>
        </div>
      )}
    </div>
  );
}
