'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Copy,
  Search,
  Trophy,
  Users,
  BarChart3,
  ClipboardList,
  Wallet,
  Gift,
  Settings,
  Activity,
} from 'lucide-react';
import { SystemBanner } from '@/components/SystemBanner';
import { WalletDropdown } from '@/components/WalletDropdown';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Copy Trade', icon: Copy },
  { href: '/dashboard/search', label: 'Search', icon: Search },
  { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/dashboard/following', label: 'Following', icon: Users },
  { href: '/dashboard/positions', label: 'Positions', icon: BarChart3 },
  { href: '/dashboard/orders', label: 'Orders', icon: ClipboardList },
  { href: '/dashboard/funds', label: 'Funds', icon: Wallet },
  { href: '/dashboard/claims', label: 'Claims', icon: Gift },
  { href: '/dashboard/activity', label: 'Activity', icon: Activity },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[--border-default] bg-[--bg-surface-dark] lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 px-6">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/25" />
          <Link href="/dashboard" className="text-lg font-bold text-white">
            Mirror Markets
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-400 shadow-sm'
                    : 'text-[--text-secondary] hover:bg-[--bg-surface-lighter] hover:text-white'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-brand-400' : ''}`} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {/* Top header */}
        <div className="flex h-16 items-center justify-between border-b border-[--border-default] bg-[--bg-surface-dark]/80 px-4 backdrop-blur-sm sm:px-6">
          <div className="lg:hidden">
            <Link href="/dashboard" className="text-lg font-bold text-white">
              MM
            </Link>
          </div>
          <div className="ml-auto">
            <WalletDropdown />
          </div>
        </div>
        <SystemBanner />
        {/* Mobile nav */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-[--border-default] bg-[--bg-surface-dark] px-3 py-2 lg:hidden">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-400'
                    : 'text-[--text-secondary] hover:bg-[--bg-surface-lighter] hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
