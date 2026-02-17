'use client';

import { useEffect, useRef, useState } from 'react';
import type { SSEEvent, SyncLogInfo } from '@mirrormarkets/shared';

interface Props {
  events: SSEEvent[];
  connected: boolean;
  recentLogs: any[];
  syncEvents: SSEEvent[];
  syncConnected: boolean;
  recentSyncLogs: SyncLogInfo[];
}

interface LogEntry {
  id: string;
  type: string;
  level: 'info' | 'warn' | 'error' | 'copy';
  message: string;
  time: string;
}

function levelColor(level: string): string {
  switch (level) {
    case 'error': return 'text-[--accent-red]';
    case 'warn': return 'text-[--accent-gold]';
    case 'copy': return 'text-[--accent-green]';
    default: return 'text-[--accent-cyan]';
  }
}

function copyLogLevel(status: string): 'info' | 'warn' | 'error' | 'copy' {
  if (status === 'FILLED' || status === 'copy_attempt' || status === 'SUBMITTED') return 'copy';
  if (status === 'FAILED') return 'error';
  if (status === 'SKIPPED') return 'warn';
  return 'info';
}

export function DaemonLogPanel({ events, connected, recentLogs, syncEvents, syncConnected, recentSyncLogs }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Build unified log timeline
  const allItems: LogEntry[] = [
    // Historical copy logs
    ...recentLogs.map((log) => ({
      id: `copy-${log.id}`,
      type: log.status ?? 'copy',
      level: copyLogLevel(log.status) as LogEntry['level'],
      message: log.skipReason ?? log.errorMessage ?? `${log.leaderEvent?.side ?? ''} order`,
      time: log.createdAt,
    })),
    // Historical sync logs
    ...recentSyncLogs.map((log) => ({
      id: `sync-${log.id}`,
      type: 'sync',
      level: log.level as LogEntry['level'],
      message: log.message,
      time: log.createdAt,
    })),
    // Live copy SSE events
    ...events.map((e, i) => ({
      id: `sse-copy-${i}`,
      type: e.type,
      level: 'copy' as const,
      message: JSON.stringify(e.data).slice(0, 120),
      time: e.timestamp,
    })),
    // Live sync SSE events
    ...syncEvents.map((e, i) => ({
      id: `sse-sync-${i}`,
      type: 'sync',
      level: ((e.data as any).level ?? 'info') as LogEntry['level'],
      message: (e.data as any).message ?? JSON.stringify(e.data).slice(0, 120),
      time: e.timestamp,
    })),
  ]
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .slice(-100);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allItems.length, autoScroll]);

  const anyConnected = connected || syncConnected;

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-[--border-default] px-4 py-3">
        <h3 className="font-semibold text-white">Daemon Logs</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoScroll((v) => !v)}
            className="text-xs text-[--text-muted] hover:text-[--text-secondary] transition-colors"
          >
            {autoScroll ? 'Pause scroll' : 'Resume scroll'}
          </button>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${anyConnected ? 'bg-[--accent-green] shadow-sm shadow-[--accent-green]/50' : 'bg-[--text-muted]'}`} />
            <span className="text-xs text-[--text-secondary]">{anyConnected ? 'Live' : 'Disconnected'}</span>
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="max-h-80 overflow-y-auto p-4 font-mono text-xs">
        {allItems.length === 0 ? (
          <p className="text-[--text-muted]">No logs yet. Follow a leader to see sync activity.</p>
        ) : (
          allItems.map((item) => (
            <div key={item.id} className="flex gap-2 py-0.5">
              <span className="shrink-0 text-[--text-muted]">{new Date(item.time).toLocaleTimeString()}</span>
              <span className={`shrink-0 font-medium ${levelColor(item.level)}`}>
                [{item.type === 'sync' ? 'SYNC' : item.type.toUpperCase()}]
              </span>
              <span className="text-[--text-primary]">{item.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
