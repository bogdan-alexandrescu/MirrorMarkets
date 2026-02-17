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
        <h1 className="page-title">Copy Trading</h1>
        <button
          onClick={() => (isEnabled ? disableCopy.mutate() : enableCopy.mutate())}
          disabled={enableCopy.isPending || disableCopy.isPending}
          className={`${isEnabled ? 'btn-danger' : 'btn-success'}`}
        >
          {isEnabled ? 'Stop Copy Trading' : 'Start Copy Trading'}
        </button>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-[--text-secondary]">Status</p>
          <p className={`text-lg font-semibold ${isEnabled ? 'text-[--accent-green]' : 'text-[--text-muted]'}`}>
            {profile?.status ?? 'DISABLED'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[--text-secondary]">Following</p>
          <p className="text-lg font-semibold text-white">{follows?.length ?? 0} leaders</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[--text-secondary]">Balance</p>
          <p className="text-lg font-semibold text-white">{balances ? formatUsd(balances.total) : '--'}</p>
        </div>
      </div>

      {profile && <GuardrailForm profile={profile} />}

      <DaemonLogPanel events={events} connected={connected} recentLogs={logs?.items ?? []} />
    </div>
  );
}
