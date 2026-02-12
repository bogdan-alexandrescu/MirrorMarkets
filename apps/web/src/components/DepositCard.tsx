'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  address: string | null;
}

export function DepositCard({ address }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Deposit USDC</h3>
      <p className="mb-4 text-sm text-gray-500">
        Send USDC on Polygon to your proxy wallet address below.
      </p>

      {address ? (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <code className="flex-1 break-all text-xs text-gray-700 dark:text-gray-300">
            {address}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          Complete account setup to get your deposit address.
        </p>
      )}
    </div>
  );
}
