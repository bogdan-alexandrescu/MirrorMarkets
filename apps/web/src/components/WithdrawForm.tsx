'use client';

import { useState } from 'react';
import { useCreateWithdrawal } from '@/hooks/useApi';
import { formatUsd } from '@mirrormarkets/shared';

interface Props {
  maxAmount: number;
}

export function WithdrawForm({ maxAmount }: Props) {
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const withdraw = useCreateWithdrawal();

  const handleSubmit = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0 || !destination) return;
    withdraw.mutate({ amount: num, destinationAddr: destination });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Withdraw USDC</h3>
      <p className="mb-4 text-sm text-gray-500">
        Available: {formatUsd(maxAmount)}
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Amount (USDC)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            max={maxAmount}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Destination Address</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={withdraw.isPending || !amount || !destination}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {withdraw.isPending ? 'Processing...' : 'Withdraw'}
        </button>
      </div>

      {withdraw.isError && (
        <p className="mt-2 text-sm text-red-500">Withdrawal failed. Please try again.</p>
      )}
      {withdraw.isSuccess && (
        <p className="mt-2 text-sm text-green-600">Withdrawal submitted successfully.</p>
      )}
    </div>
  );
}
