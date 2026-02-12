'use client';

import type { SSEEvent } from '@mirrormarkets/shared';

interface Props {
  events: SSEEvent[];
  connected: boolean;
  recentLogs: any[];
}

export function DaemonLogPanel({ events, connected, recentLogs }: Props) {
  const allItems = [
    ...recentLogs.map((log) => ({
      id: log.id,
      type: log.status,
      message: log.skipReason ?? log.errorMessage ?? `${log.leaderEvent?.side ?? ''} order`,
      time: log.createdAt,
    })),
    ...events.map((e, i) => ({
      id: `sse-${i}`,
      type: e.type,
      message: JSON.stringify(e.data).slice(0, 120),
      time: e.timestamp,
    })),
  ].slice(-30);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white">Daemon Logs</h3>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`}
          />
          <span className="text-xs text-gray-500">
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto p-4 font-mono text-xs">
        {allItems.length === 0 ? (
          <p className="text-gray-400">No logs yet. Enable copy trading to see activity.</p>
        ) : (
          allItems.map((item) => (
            <div key={item.id} className="flex gap-2 py-0.5">
              <span className="shrink-0 text-gray-400">
                {new Date(item.time).toLocaleTimeString()}
              </span>
              <span className={`shrink-0 font-medium ${
                item.type === 'FILLED' || item.type === 'copy_attempt' ? 'text-green-600' :
                item.type === 'FAILED' ? 'text-red-600' :
                item.type === 'SKIPPED' ? 'text-yellow-600' :
                'text-gray-600'
              }`}>
                [{item.type}]
              </span>
              <span className="text-gray-700 dark:text-gray-300">{item.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
