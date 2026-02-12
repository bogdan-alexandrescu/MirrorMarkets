'use client';

import { useCopyLogs } from '@/hooks/useApi';
import { useState } from 'react';

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCopyLogs(page);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Log</h1>

      {isLoading ? (
        <p className="text-gray-500">Loading activity...</p>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="space-y-3">
            {data.items.map((item: any) => (
              <div
                key={item.id}
                className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.status === 'FILLED' ? 'bg-green-100 text-green-700' :
                    item.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                    item.status === 'SKIPPED' ? 'bg-gray-100 text-gray-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {item.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                {item.leaderEvent && (
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">{item.leaderEvent.side}</span>{' '}
                    {item.leaderEvent.size} @ {item.leaderEvent.price}
                    {item.leaderEvent.marketSlug && (
                      <span className="ml-2 text-gray-400">({item.leaderEvent.marketSlug})</span>
                    )}
                  </div>
                )}
                {item.skipReason && (
                  <p className="mt-1 text-xs text-gray-400">Skip: {item.skipReason}</p>
                )}
                {item.errorMessage && (
                  <p className="mt-1 text-xs text-red-500">Error: {item.errorMessage}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasMore}
              className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <p className="text-gray-500">No activity yet. Start copy trading to see activity here.</p>
      )}
    </div>
  );
}
