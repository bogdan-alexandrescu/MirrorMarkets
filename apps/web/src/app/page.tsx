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
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          Mirror Markets
        </h1>
        <p className="mb-8 text-lg text-gray-600 dark:text-gray-400">
          Copy trade the best Polymarket traders automatically.
        </p>

        {status !== 'logged-in' ? (
          <button
            onClick={login}
            className="rounded-lg bg-brand-600 px-8 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Sign in with Email
          </button>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">
            Signing in...
          </p>
        )}
      </div>
    </div>
  );
}
