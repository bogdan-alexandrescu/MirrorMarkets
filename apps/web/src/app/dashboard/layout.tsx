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
      <aside className="hidden w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:block">
        <div className="flex h-16 items-center px-6">
          <Link href="/dashboard" className="text-xl font-bold text-brand-600">
            Mirror Markets
          </Link>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        {/* Top header */}
        <div className="flex h-16 items-center justify-end border-b border-gray-200 px-6 dark:border-gray-800">
          <WalletDropdown />
        </div>
        <SystemBanner />
        {/* Mobile nav */}
        <div className="flex gap-2 overflow-x-auto border-b border-gray-200 px-4 py-2 dark:border-gray-800 lg:hidden">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                  isActive
                    ? 'bg-brand-100 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
