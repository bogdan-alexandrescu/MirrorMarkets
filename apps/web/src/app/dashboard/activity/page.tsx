'use client';

import { useCopyLogs } from '@/hooks/useApi';
import { useState } from 'react';

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCopyLogs(page);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Activity Log</h1>

      {isLoading ? (
        <p className="text-[--text-muted]">Loading activity...</p>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="space-y-3">
            {data.items.map((item: any) => (
              <div key={item.id} className="card p-4">
                <div className="flex items-center justify-between">
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
                  <span className="text-xs text-[--text-muted]">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                {item.leaderEvent && (
                  <div className="mt-2 text-sm text-[--text-secondary]">
                    <span className="font-medium text-[--text-primary]">{item.leaderEvent.side}</span>{' '}
                    {item.leaderEvent.size} @ {item.leaderEvent.price}
                    {item.leaderEvent.marketSlug && (
                      <span className="ml-2 text-[--text-muted]">({item.leaderEvent.marketSlug})</span>
                    )}
                  </div>
                )}
                {item.skipReason && (
                  <p className="mt-1 text-xs text-[--text-muted]">Skip: {item.skipReason}</p>
                )}
                {item.errorMessage && (
                  <p className="mt-1 text-xs text-[--accent-red]">Error: {item.errorMessage}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            <span className="text-sm text-[--text-muted]">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasMore}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <p className="text-[--text-muted]">No activity yet. Start copy trading to see activity here.</p>
      )}
    </div>
  );
}
