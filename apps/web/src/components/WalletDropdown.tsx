'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@crossmint/client-sdk-react-ui';
import { Copy, Check, LogOut, Wallet, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useMe, useMyWallets, useBalances } from '@/hooks/useApi';
import { shortenAddress, formatUsd } from '@mirrormarkets/shared';
import { api } from '@/lib/api-client';

export function WalletDropdown() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user: crossmintUser, logout } = useAuth();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: wallets, isLoading: walletsLoading } = useMyWallets();
  const { data: balances } = useBalances();

  const primaryWallet = wallets?.find((w) => w.type === 'POLY_PROXY') ?? wallets?.find((w) => w.type === 'DYNAMIC_EOA');
  const address = primaryWallet?.address;

  const displayName = me?.name ?? me?.email ?? crossmintUser?.email ?? 'User';
  const displayEmail = me?.email ?? crossmintUser?.email;
  const hasToken = !!api.getToken();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    api.setToken(null);
    logout();
    window.location.href = '/';
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-[--border-accent] bg-[--bg-surface] px-3 py-2 text-sm transition hover:bg-[--bg-surface-light]"
      >
        {me?.avatarUrl ? (
          <img src={me.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-400">
            {displayName[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <span className="hidden text-[--text-primary] sm:inline">
          {address ? shortenAddress(address) : hasToken && walletsLoading ? 'Loading...' : displayName}
        </span>
        <ChevronDown className="h-4 w-4 text-[--text-muted]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[--border-default] bg-[--bg-surface] p-4 shadow-2xl shadow-black/40">
          <div className="mb-3 border-b border-[--border-default] pb-3">
            <p className="text-sm font-medium text-white">{displayName}</p>
            {displayEmail && displayName !== displayEmail && (
              <p className="text-xs text-[--text-secondary]">{displayEmail}</p>
            )}
          </div>

          {address && (
            <div className="mb-3">
              <p className="mb-1 text-xs text-[--text-muted]">Wallet Address</p>
              <div className="flex items-center gap-2 rounded-lg bg-[--bg-surface-dark] px-2.5 py-1.5">
                <code className="flex-1 text-xs text-[--text-secondary]">{shortenAddress(address, 8)}</code>
                <button onClick={handleCopy} className="shrink-0 text-[--text-muted] transition hover:text-white">
                  {copied ? <Check className="h-3.5 w-3.5 text-[--accent-green]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}

          {balances && (
            <div className="mb-3 border-b border-[--border-default] pb-3">
              <div className="flex justify-between text-sm">
                <span className="text-[--text-secondary]">USDC</span>
                <span className="font-medium text-white">{formatUsd(balances.usdc)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[--text-secondary]">Portfolio</span>
                <span className="font-medium text-white">{formatUsd(balances.total)}</span>
              </div>
            </div>
          )}

          <div className="space-y-0.5">
            <Link
              href="/dashboard/funds"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[--text-secondary] transition hover:bg-[--bg-surface-lighter] hover:text-white"
            >
              <Wallet className="h-4 w-4" />
              Funds
            </Link>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[--accent-red] transition hover:bg-[--accent-red]/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
