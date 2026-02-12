'use client';

import { useBalances, useDepositAddress, useWithdrawals } from '@/hooks/useApi';
import { DepositCard } from '@/components/DepositCard';
import { WithdrawForm } from '@/components/WithdrawForm';
import { formatUsd } from '@mirrormarkets/shared';

export default function FundsPage() {
  const { data: balances } = useBalances();
  const { data: deposit } = useDepositAddress();
  const { data: withdrawals } = useWithdrawals();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Funds</h1>

      {/* Balance overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">USDC Balance</p>
          <p className="text-lg font-semibold">{balances ? formatUsd(balances.usdc) : '--'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">In Positions</p>
          <p className="text-lg font-semibold">{balances ? formatUsd(balances.positions) : '--'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Total Value</p>
          <p className="text-lg font-semibold">{balances ? formatUsd(balances.total) : '--'}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Deposit */}
        <DepositCard address={deposit?.address ?? null} />

        {/* Withdraw */}
        <WithdrawForm maxAmount={balances?.usdc ?? 0} />
      </div>

      {/* Withdrawal history */}
      {withdrawals && withdrawals.items.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Withdrawal History
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Destination</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {withdrawals.items.map((w: any) => (
                  <tr key={w.id}>
                    <td className="px-4 py-2">{formatUsd(w.amount)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{w.destinationAddr}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        w.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                        w.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
