'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLeader, useLeaderEvents, useCopyLogsForLeader, useFollows, useRemoveFollow } from '@/hooks/useApi';
import { shortenAddress, formatUsd, formatPnl } from '@mirrormarkets/shared';

export default function LeaderDetailPage() {
  const { leaderAddress } = useParams<{ leaderAddress: string }>();
  const router = useRouter();
  const { data: leader, isLoading: leaderLoading, error: leaderError } = useLeader(leaderAddress);
  const { data: follows } = useFollows();
  const removeFollow = useRemoveFollow();
  const [eventsPage, setEventsPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const { data: events, isLoading: eventsLoading } = useLeaderEvents(leaderAddress, eventsPage);
  const { data: copyLogs, isLoading: logsLoading } = useCopyLogsForLeader(leaderAddress, logsPage);

  const follow = follows?.find((f) => f.leader.address.toLowerCase() === leaderAddress.toLowerCase());

  const handleUnfollow = () => {
    if (!follow) return;
    removeFollow.mutate(follow.id, {
      onSuccess: () => router.push('/dashboard/following'),
    });
  };

  if (leaderLoading) {
    return <p className="text-[--text-muted]">Loading leader...</p>;
  }

  if (leaderError) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/following"
          className="inline-flex items-center gap-1 text-sm text-[--text-secondary] hover:text-[--text-primary]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Following
        </Link>
        <div className="card border-[--accent-red]/30 bg-[--accent-red]/10 p-4">
          <p className="text-sm text-[--accent-red]">
            Failed to load leader. {leaderError.message}
          </p>
        </div>
      </div>
    );
  }

  if (!leader) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/following"
          className="inline-flex items-center gap-1 text-sm text-[--text-secondary] hover:text-[--text-primary]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Following
        </Link>
        <p className="text-[--text-muted]">Leader not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/following"
        className="inline-flex items-center gap-1 text-sm text-[--text-secondary] hover:text-[--text-primary]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Following
      </Link>

      {/* Leader info card */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          {leader.profileImageUrl ? (
            <img
              src={leader.profileImageUrl}
              alt=""
              className="h-16 w-16 rounded-full bg-[--bg-surface-lighter]"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/20 text-xl font-bold text-brand-400">
              {(leader.displayName ?? leader.address)[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[--text-primary]">
                {leader.displayName ?? shortenAddress(leader.address)}
              </h1>
              {leader.rank && (
                <span className="badge-warning">#{leader.rank}</span>
              )}
            </div>
            <p className="mt-1 text-sm text-[--text-muted]">{leader.address}</p>
            <div className="mt-3 flex gap-6 text-sm">
              <div>
                <span className="text-[--text-secondary]">PnL </span>
                <span className={`font-semibold ${leader.pnl >= 0 ? 'text-[--accent-green]' : 'text-[--accent-red]'}`}>
                  {formatPnl(leader.pnl)}
                </span>
              </div>
              <div>
                <span className="text-[--text-secondary]">Volume </span>
                <span className="font-semibold text-[--text-primary]">
                  {formatUsd(leader.volume)}
                </span>
              </div>
            </div>
          </div>
          {follow && (
            <button
              onClick={handleUnfollow}
              disabled={removeFollow.isPending}
              className="btn-danger shrink-0"
            >
              {removeFollow.isPending ? 'Unfollowing...' : 'Unfollow'}
            </button>
          )}
        </div>
      </div>

      {/* Recent Trades */}
      <div>
        <h2 className="section-title mb-3">Recent Trades</h2>
        {eventsLoading ? (
          <p className="text-[--text-muted]">Loading trades...</p>
        ) : events && events.items.length > 0 ? (
          <>
            <div className="table-wrapper">
              <table className="table-base">
                <thead className="table-head">
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th">Side</th>
                    <th className="table-th">Market</th>
                    <th className="table-th-right">Size</th>
                    <th className="table-th-right">Price</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {events.items.map((event) => (
                    <tr key={event.id}>
                      <td className="table-td-secondary">
                        {new Date(event.detectedAt).toLocaleString()}
                      </td>
                      <td className="table-td">
                        <span className={event.side === 'BUY' ? 'badge-success' : 'badge-danger'}>
                          {event.side}
                        </span>
                      </td>
                      <td className="table-td">
                        {event.marketSlug ?? event.conditionId.slice(0, 12) + '...'}
                      </td>
                      <td className="table-td text-right font-mono">
                        {formatUsd(event.size)}
                      </td>
                      <td className="table-td text-right font-mono">
                        {event.price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-between">
              <button
                onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                disabled={eventsPage === 1}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="text-sm text-[--text-muted]">Page {eventsPage}</span>
              <button
                onClick={() => setEventsPage((p) => p + 1)}
                disabled={!events.hasMore}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-[--text-muted]">No trades recorded yet.</p>
        )}
      </div>

      {/* Copied Trades */}
      <div>
        <h2 className="section-title mb-3">Copied Trades</h2>
        {logsLoading ? (
          <p className="text-[--text-muted]">Loading copy logs...</p>
        ) : copyLogs && copyLogs.items.length > 0 ? (
          <>
            <div className="table-wrapper">
              <table className="table-base">
                <thead className="table-head">
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Side</th>
                    <th className="table-th">Market</th>
                    <th className="table-th-right">Size</th>
                    <th className="table-th-right">Price</th>
                    <th className="table-th">Reason</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {copyLogs.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="table-td-secondary">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="table-td">
                        <span
                          className={
                            item.status === 'FILLED'
                              ? 'badge-success'
                              : item.status === 'FAILED'
                                ? 'badge-danger'
                                : item.status === 'SKIPPED'
                                  ? 'badge-neutral'
                                  : 'badge-info'
                          }
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="table-td">
                        {item.leaderEvent && (
                          <span className={item.leaderEvent.side === 'BUY' ? 'badge-success' : 'badge-danger'}>
                            {item.leaderEvent.side}
                          </span>
                        )}
                      </td>
                      <td className="table-td">
                        {item.leaderEvent?.marketSlug ?? '--'}
                      </td>
                      <td className="table-td text-right font-mono">
                        {item.leaderEvent ? formatUsd(item.leaderEvent.size) : '--'}
                      </td>
                      <td className="table-td text-right font-mono">
                        {item.leaderEvent ? item.leaderEvent.price.toFixed(2) : '--'}
                      </td>
                      <td className="table-td-secondary text-xs">
                        {item.skipReason ?? item.errorMessage ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-between">
              <button
                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                disabled={logsPage === 1}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="text-sm text-[--text-muted]">Page {logsPage}</span>
              <button
                onClick={() => setLogsPage((p) => p + 1)}
                disabled={!copyLogs.hasMore}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-[--text-muted]">No copied trades for this leader yet.</p>
        )}
      </div>
    </div>
  );
}
