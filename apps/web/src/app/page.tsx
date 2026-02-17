'use client';

import { useAuth } from '@crossmint/client-sdk-react-ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api-client';

export default function HomePage() {
  const { user, login, logout, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'logged-in') return;

    // Already have a backend session — go to dashboard
    if (api.getToken()) {
      router.replace('/dashboard');
    }
    // Otherwise AuthSync in providers.tsx handles verification
  }, [status, router]);

  const onLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors — session may already be expired
    }
    api.setToken(null);
    logout();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Gradient glow behind content */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/10 blur-[120px]" />
      </div>

      <div className="relative max-w-lg text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-2xl shadow-brand-500/30" />
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Mirror Markets
        </h1>
        <p className="mb-10 text-lg text-[--text-secondary]">
          Copy trade the best Polymarket traders automatically.
        </p>

        {status !== 'logged-in' ? (
          <button
            onClick={login}
            className="btn-primary px-10 py-3.5 text-base"
          >
            Sign in with Email
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-[--text-secondary]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            Signing in...
          </div>
        )}
      </div>
    </div>
  );
}
