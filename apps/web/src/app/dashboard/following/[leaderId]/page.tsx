'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLeader, useLeaderEvents, useCopyLogsForLeader } from '@/hooks/useApi';
import { shortenAddress, formatUsd, formatPnl } from '@mirrormarkets/shared';

export default function LeaderDetailPage() {
  const { leaderId } = useParams<{ leaderId: string }>();
  const { data: leader, isLoading: leaderLoading } = useLeader(leaderId);
  const [eventsPage, setEventsPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const { data: events, isLoading: eventsLoading } = useLeaderEvents(leaderId, eventsPage);
  const { data: copyLogs, isLoading: logsLoading } = useCopyLogsForLeader(leaderId, logsPage);

  if (leaderLoading) {
    return <p className="text-gray-500">Loading leader...</p>;
  }

  if (!leader) {
    return <p className="text-gray-500">Leader not found.</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/following"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Following
      </Link>

      {/* Leader info card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-4">
          {leader.profileImageUrl ? (
            <img
              src={leader.profileImageUrl}
              alt=""
              className="h-16 w-16 rounded-full bg-gray-100"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-600">
              {(leader.displayName ?? leader.address)[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {leader.displayName ?? shortenAddress(leader.address)}
              </h1>
              {leader.rank && (
                <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-sm font-medium text-yellow-700">
                  #{leader.rank}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">{leader.address}</p>
            <div className="mt-3 flex gap-6 text-sm">
              <div>
                <span className="text-gray-500">PnL </span>
                <span className={`font-semibold ${leader.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPnl(leader.pnl)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Volume </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatUsd(leader.volume)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Recent Trades</h2>
        {eventsLoading ? (
          <p className="text-gray-500">Loading trades...</p>
        ) : events && events.items.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Side</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Market</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Size</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {events.items.map((event) => (
                    <tr key={event.id}>
                      <td className="px-4 py-2 text-gray-500">
                        {new Date(event.detectedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          event.side === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {event.side}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        {event.marketSlug ?? event.conditionId.slice(0, 12) + '...'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gray-900 dark:text-white">
                        {formatUsd(event.size)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gray-900 dark:text-white">
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
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {eventsPage}</span>
              <button
                onClick={() => setEventsPage((p) => p + 1)}
                disabled={!events.hasMore}
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">No trades recorded yet.</p>
        )}
      </div>

      {/* Copied Trades */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Copied Trades</h2>
        {logsLoading ? (
          <p className="text-gray-500">Loading copy logs...</p>
        ) : copyLogs && copyLogs.items.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Side</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Market</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Size</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Price</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {copyLogs.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.status === 'FILLED' ? 'bg-green-100 text-green-700' :
                          item.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                          item.status === 'SKIPPED' ? 'bg-gray-100 text-gray-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {item.leaderEvent && (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.leaderEvent.side === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {item.leaderEvent.side}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        {item.leaderEvent?.marketSlug ?? '--'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gray-900 dark:text-white">
                        {item.leaderEvent ? formatUsd(item.leaderEvent.size) : '--'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gray-900 dark:text-white">
                        {item.leaderEvent ? item.leaderEvent.price.toFixed(2) : '--'}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
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
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {logsPage}</span>
              <button
                onClick={() => setLogsPage((p) => p + 1)}
                disabled={!copyLogs.hasMore}
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">No copied trades for this leader yet.</p>
        )}
      </div>
    </div>
  );
}
