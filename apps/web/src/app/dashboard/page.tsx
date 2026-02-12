'use client';

import { useCopyProfile, useEnableCopy, useDisableCopy, useFollows, useCopyLogs, useBalances } from '@/hooks/useApi';
import { useSSE } from '@/hooks/useSSE';
import { DaemonLogPanel } from '@/components/DaemonLogPanel';
import { GuardrailForm } from '@/components/GuardrailForm';
import { formatUsd } from '@mirrormarkets/shared';

export default function CopyTradePage() {
  const { data: profile } = useCopyProfile();
  const { data: follows } = useFollows();
  const { data: balances } = useBalances();
  const { data: logs } = useCopyLogs();
  const enableCopy = useEnableCopy();
  const disableCopy = useDisableCopy();
  const { events, connected } = useSSE('/copy/logs/stream', profile?.status === 'ENABLED');

  const isEnabled = profile?.status === 'ENABLED';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Copy Trading</h1>
        <button
          onClick={() => (isEnabled ? disableCopy.mutate() : enableCopy.mutate())}
          disabled={enableCopy.isPending || disableCopy.isPending}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
            isEnabled
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          } disabled:opacity-50`}
        >
          {isEnabled ? 'Stop Copy Trading' : 'Start Copy Trading'}
        </button>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Status</p>
          <p className={`text-lg font-semibold ${isEnabled ? 'text-green-600' : 'text-gray-400'}`}>
            {profile?.status ?? 'DISABLED'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Following</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {follows?.length ?? 0} leaders
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Balance</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {balances ? formatUsd(balances.total) : '--'}
          </p>
        </div>
      </div>

      {/* Guardrails */}
      {profile && <GuardrailForm profile={profile} />}

      {/* Live daemon logs */}
      <DaemonLogPanel
        events={events}
        connected={connected}
        recentLogs={logs?.items ?? []}
      />
    </div>
  );
}
