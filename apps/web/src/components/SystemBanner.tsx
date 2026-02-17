'use client';

import { useSystemStatus } from '@/hooks/useApi';
import { AlertTriangle } from 'lucide-react';

export function SystemBanner() {
  const { data: status } = useSystemStatus();

  if (!status || status.api === 'ok') return null;

  return (
    <div className="flex items-center gap-2 bg-[--accent-gold]/10 px-4 py-2.5 text-sm text-[--accent-gold]">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        System is experiencing issues.
        {status.database === 'down' && ' Database is down.'}
        {status.redis === 'down' && ' Redis is down.'}
        {status.polymarketClob === 'down' && ' Polymarket API is unreachable.'}
      </span>
    </div>
  );
}
