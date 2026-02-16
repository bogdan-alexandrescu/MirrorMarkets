'use client';

import { CrossmintProvider, CrossmintAuthProvider, useAuth } from '@crossmint/client-sdk-react-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';

function AuthSync({ children }: { children: React.ReactNode }) {
  const { jwt, user, status } = useAuth();
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (status !== 'logged-in' || !jwt || !user?.email || verifiedRef.current) return;

    // If we already have a backend session, just redirect
    if (api.getToken()) {
      window.location.href = '/dashboard';
      return;
    }

    verifiedRef.current = true;

    (async () => {
      try {
        const res = await api.post<{ token: string }>('/auth/crossmint/verify', {
          token: jwt,
          ...(user?.email ? { email: user.email } : {}),
        });
        api.setToken(res.token);
        try {
          await api.post('/wallets/provision', {});
        } catch {
          // Continue even if provisioning fails
        }
        window.location.href = '/dashboard';
      } catch (err) {
        console.error('[AuthSync] Backend auth verify failed:', err);
        verifiedRef.current = false;
      }
    })();
  }, [jwt, user, status]);

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
