'use client';

import { useSystemStatus } from '@/hooks/useApi';
import { AlertTriangle } from 'lucide-react';

export function SystemBanner() {
  const { data: status } = useSystemStatus();

  if (!status || status.api === 'ok') return null;

  return (
    <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
      <AlertTriangle className="h-4 w-4" />
      <span>
        System is experiencing issues.
        {status.database === 'down' && ' Database is down.'}
        {status.redis === 'down' && ' Redis is down.'}
        {status.polymarketClob === 'down' && ' Polymarket API is unreachable.'}
      </span>
    </div>
  );
}
