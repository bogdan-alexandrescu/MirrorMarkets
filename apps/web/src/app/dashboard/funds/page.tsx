'use client';

import { useState } from 'react';
import { useBalances, useDepositAddress, useWithdrawals, useApprovalStatus, useApproveExchange } from '@/hooks/useApi';
import { DepositCard } from '@/components/DepositCard';
import { WithdrawForm } from '@/components/WithdrawForm';
import { formatUsd } from '@mirrormarkets/shared';

export default function FundsPage() {
  const { data: balances } = useBalances();
  const { data: deposit } = useDepositAddress();
  const { data: approvalStatus } = useApprovalStatus();
  const approveExchange = useApproveExchange();
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const { data: withdrawals } = useWithdrawals(withdrawalPage);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Funds</h1>

      {/* Balance overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-[--text-secondary]">USDC Balance</p>
          <p className="text-lg font-semibold text-[--text-primary]">{balances ? formatUsd(balances.usdc) : '--'}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[--text-secondary]">In Positions</p>
          <p className="text-lg font-semibold text-[--text-primary]">{balances ? formatUsd(balances.positions) : '--'}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-[--text-secondary]">Total Value</p>
          <p className="text-lg font-semibold text-[--text-primary]">{balances ? formatUsd(balances.total) : '--'}</p>
        </div>
      </div>

      {/* Exchange Approval */}
      <div className="card p-4">
        {approvalStatus?.approved ? (
          <div className="flex items-center gap-2">
            <span className="badge-success">Approved</span>
            <span className="text-sm text-[--text-secondary]">Exchange trading enabled</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[--text-primary]">Enable Trading</p>
              <p className="text-sm text-[--text-secondary]">
                Approve the exchange to settle trades. Gasless — no MATIC needed.
              </p>
            </div>
            <button
              onClick={() => approveExchange.mutate()}
              disabled={approveExchange.isPending}
              className="btn-primary"
            >
              {approveExchange.isPending ? 'Approving...' : 'Approve Exchange'}
            </button>
          </div>
        )}
        {approveExchange.isError && (
          <p className="mt-2 text-sm text-[--danger]">
            {approveExchange.error instanceof Error ? approveExchange.error.message : 'Approval failed'}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Deposit */}
        <DepositCard address={deposit?.address ?? null} />

        {/* Withdraw */}
        <WithdrawForm maxAmount={balances?.usdc ?? 0} />
      </div>

      {/* Withdrawal history */}
      <div>
        <h2 className="section-title mb-3">Withdrawal History</h2>
        {withdrawals && withdrawals.items.length > 0 ? (
          <>
            <div className="table-wrapper">
              <table className="table-base">
                <thead className="table-head">
                  <tr>
                    <th className="table-th">Amount</th>
                    <th className="table-th">Destination</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Date</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {withdrawals.items.map((w: any) => (
                    <tr key={w.id}>
                      <td className="table-td">{formatUsd(w.amount)}</td>
                      <td className="table-td font-mono text-xs">{w.destinationAddr}</td>
                      <td className="table-td">
                        <span
                          className={
                            w.status === 'CONFIRMED'
                              ? 'badge-success'
                              : w.status === 'FAILED'
                                ? 'badge-danger'
                                : 'badge-warning'
                          }
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="table-td-secondary">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-between">
              <button
                onClick={() => setWithdrawalPage((p) => Math.max(1, p - 1))}
                disabled={withdrawalPage === 1}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="text-sm text-[--text-muted]">Page {withdrawalPage}</span>
              <button
                onClick={() => setWithdrawalPage((p) => p + 1)}
                disabled={!withdrawals.hasMore}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-[--text-muted]">No withdrawals yet.</p>
        )}
      </div>
    </div>
  );
}
