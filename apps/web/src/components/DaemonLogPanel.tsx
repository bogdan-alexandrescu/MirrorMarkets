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
    <div className="card">
      <div className="flex items-center justify-between border-b border-[--border-default] px-4 py-3">
        <h3 className="font-semibold text-white">Daemon Logs</h3>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-[--accent-green] shadow-sm shadow-[--accent-green]/50' : 'bg-[--text-muted]'}`} />
          <span className="text-xs text-[--text-secondary]">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto p-4 font-mono text-xs">
        {allItems.length === 0 ? (
          <p className="text-[--text-muted]">No logs yet. Enable copy trading to see activity.</p>
        ) : (
          allItems.map((item) => (
            <div key={item.id} className="flex gap-2 py-0.5">
              <span className="shrink-0 text-[--text-muted]">{new Date(item.time).toLocaleTimeString()}</span>
              <span className={`shrink-0 font-medium ${
                item.type === 'FILLED' || item.type === 'copy_attempt' ? 'text-[--accent-green]' :
                item.type === 'FAILED' ? 'text-[--accent-red]' :
                item.type === 'SKIPPED' ? 'text-[--accent-gold]' :
                'text-[--text-secondary]'
              }`}>[{item.type}]</span>
              <span className="text-[--text-primary]">{item.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
