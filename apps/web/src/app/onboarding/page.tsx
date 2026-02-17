'use client';

import { useProvisioningStatus, useProvision } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

const STEPS = [
  { key: 'serverWallet', label: 'Create signing wallet' },
  { key: 'clobCredentials', label: 'Connect to Polymarket' },
  { key: 'polyProxy', label: 'Set up trading wallet' },
  { key: 'copyProfile', label: 'Initialize copy profile' },
] as const;

export default function OnboardingPage() {
  const { data: status, isLoading } = useProvisioningStatus();
  const provision = useProvision();
  const router = useRouter();

  useEffect(() => {
    if (status?.complete) {
      router.push('/dashboard');
    }
  }, [status?.complete, router]);

  const handleProvision = () => {
    provision.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-bold text-white">
          Account Setup
        </h1>
        <p className="mb-8 text-[--text-secondary]">
          We need to set up your trading infrastructure. This only happens once.
        </p>

        <div className="mb-8 space-y-4">
          {STEPS.map(({ key, label }) => {
            const done = status?.[key] ?? false;
            return (
              <div key={key} className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-[--accent-green]" />
                ) : provision.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                ) : (
                  <Circle className="h-5 w-5 text-[--text-muted]" />
                )}
                <span className={done ? 'text-white' : 'text-[--text-secondary]'}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {!status?.complete && (
          <button
            onClick={handleProvision}
            disabled={provision.isPending || isLoading}
            className="btn-primary w-full py-3"
          >
            {provision.isPending ? 'Setting up...' : 'Start Setup'}
          </button>
        )}

        {provision.isError && (
          <p className="mt-4 text-sm text-[--accent-red]">
            Setup failed. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
