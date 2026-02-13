'use client';

import Link from 'next/link';
import { useFollows } from '@/hooks/useApi';
import { shortenAddress, formatUsd, formatPnl } from '@mirrormarkets/shared';

export default function FollowingPage() {
  const { data: follows, isLoading, error } = useFollows();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Following</h1>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            Failed to load follows. {error.message}
          </p>
        </div>
      ) : follows && follows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {follows.map((follow) => (
            <Link
              key={follow.id}
              href={`/dashboard/following/${follow.leader.id}`}
              className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {follow.leader.profileImageUrl ? (
                    <img
                      src={follow.leader.profileImageUrl}
                      alt=""
                      className="h-10 w-10 rounded-full bg-gray-100"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
                      {(follow.leader.displayName ?? follow.leader.address)[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {follow.leader.displayName ?? shortenAddress(follow.leader.address)}
                    </p>
                    <p className="text-xs text-gray-500">{shortenAddress(follow.leader.address)}</p>
                  </div>
                </div>
                {follow.leader.rank && (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                    #{follow.leader.rank}
                  </span>
                )}
              </div>

              <div className="mt-3 flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500">PnL </span>
                  <span className={`font-medium ${(follow.leader.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPnl(follow.leader.pnl ?? 0)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Volume </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatUsd(follow.leader.volume ?? 0)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  follow.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                  follow.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {follow.status}
                </span>
                <span className="text-xs text-brand-600">View details →</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500">
            You&apos;re not following anyone yet. Visit the{' '}
            <Link href="/dashboard/leaderboard" className="text-brand-600 hover:underline">
              Leaderboard
            </Link>{' '}
            to find traders.
          </p>
        </div>
      )}
    </div>
  );
}
