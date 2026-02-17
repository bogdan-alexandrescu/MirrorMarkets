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
    <div className="card p-6">
      <h3 className="mb-2 section-title">Withdraw USDC</h3>
      <p className="mb-4 text-sm text-[--text-secondary]">Available: {formatUsd(maxAmount)}</p>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-[--text-secondary]">Amount (USDC)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" max={maxAmount} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-[--text-secondary]">Destination Address</label>
          <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="0x..." className="input-field" />
        </div>
        <button onClick={handleSubmit} disabled={withdraw.isPending || !amount || !destination} className="btn-primary w-full">
          {withdraw.isPending ? 'Processing...' : 'Withdraw'}
        </button>
      </div>
      {withdraw.isError && <p className="mt-2 text-sm text-[--accent-red]">Withdrawal failed. Please try again.</p>}
      {withdraw.isSuccess && <p className="mt-2 text-sm text-[--accent-green]">Withdrawal submitted successfully.</p>}
    </div>
  );
}
