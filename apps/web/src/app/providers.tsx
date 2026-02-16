'use client';

import { CrossmintProvider, CrossmintAuthProvider, useAuth } from '@crossmint/client-sdk-react-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';

function AuthSync({ children }: { children: React.ReactNode }) {
  const { jwt, status } = useAuth();
  const verifiedRef = useRef(false);

  useEffect(() => {
    console.log('[AuthSync] status:', status, 'jwt:', jwt ? `${jwt.slice(0, 20)}...` : undefined, 'hasToken:', !!api.getToken(), 'verified:', verifiedRef.current);

    if (status !== 'logged-in' || !jwt || verifiedRef.current) return;

    // If we already have a backend session, just redirect
    if (api.getToken()) {
      window.location.href = '/dashboard';
      return;
    }

    verifiedRef.current = true;

    (async () => {
      try {
        console.log('[AuthSync] Verifying Crossmint JWT with backend...');
        const res = await api.post<{ token: string }>('/auth/crossmint/verify', { token: jwt });
        api.setToken(res.token);
        console.log('[AuthSync] Backend session created, provisioning wallet...');
        try {
          await api.post('/wallets/provision', {});
        } catch {
          // Continue even if provisioning fails
        }
        console.log('[AuthSync] Redirecting to dashboard');
        window.location.href = '/dashboard';
      } catch (err) {
        console.error('[AuthSync] Backend auth verify failed:', err);
        verifiedRef.current = false;
      }
    })();
  }, [jwt, status]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <CrossmintProvider apiKey={process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY ?? ''}>
      <CrossmintAuthProvider loginMethods={['email', 'google']}>
        <QueryClientProvider client={queryClient}>
          <AuthSync>{children}</AuthSync>
        </QueryClientProvider>
      </CrossmintAuthProvider>
    </CrossmintProvider>
  );
}
