'use client';

import { useState } from 'react';
import { Copy, Check, CheckCircle, Circle, Loader2 } from 'lucide-react';
import { useProvisioningStatus, useProvision } from '@/hooks/useApi';

interface Props {
  address: string | null;
}

export function DepositCard({ address }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card p-6">
      <h3 className="mb-2 section-title">Deposit USDC</h3>
      <p className="mb-4 text-sm text-[--text-secondary]">
        Send USDC on Polygon to your proxy wallet address below.
      </p>

      {address ? (
        <div className="flex items-center gap-2 rounded-lg bg-[--bg-surface-dark] p-3">
          <code className="flex-1 break-all text-xs text-[--text-secondary]">{address}</code>
          <button onClick={handleCopy} className="shrink-0 rounded p-1 text-[--text-muted] transition hover:text-white">
            {copied ? <Check className="h-4 w-4 text-[--accent-green]" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        <ProvisioningChecklist />
      )}
    </div>
  );
}

function ProvisioningChecklist() {
  const { data: status, isLoading } = useProvisioningStatus();
  const provision = useProvision();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[--text-muted]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking account status...
      </div>
    );
  }

  if (!status) {
    return <p className="text-sm text-[--text-muted]">Unable to check account status.</p>;
  }

  const steps = [
    {
      label: 'Create server wallet',
      done: status.serverWalletReady,
      inProgress: status.serverWallet && !status.serverWalletReady,
      action: !status.serverWallet ? () => provision.mutate() : undefined,
      actionLabel: 'Create',
    },
    {
      label: 'Proxy wallet ready',
      done: status.polyProxy,
      inProgress: status.serverWalletReady && !status.polyProxy,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-[--text-secondary]">Complete these steps to get your deposit address:</p>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3">
          {step.done ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-[--accent-green]" />
          ) : step.inProgress ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-400" />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-[--text-muted]" />
          )}
          <span className={`flex-1 text-sm ${step.done ? 'text-[--text-muted] line-through' : 'text-[--text-primary]'}`}>
            {step.label}
          </span>
          {step.action && !step.done && !step.inProgress && (
            <button
              onClick={step.action}
              disabled={provision.isPending}
              className="rounded-lg border border-brand-500/30 px-3 py-1 text-xs font-medium text-brand-400 transition hover:bg-brand-500/10 disabled:opacity-50"
            >
              {provision.isPending ? 'Creating...' : step.actionLabel}
            </button>
          )}
          {step.inProgress && <span className="text-xs text-[--text-muted]">Setting up...</span>}
        </div>
      ))}
    </div>
  );
}
