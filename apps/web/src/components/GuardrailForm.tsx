'use client';

import { useState } from 'react';
import { useUpdateCopyProfile } from '@/hooks/useApi';
import type { CopyProfileInfo } from '@mirrormarkets/shared';

interface Props {
  profile: CopyProfileInfo;
}

export function GuardrailForm({ profile }: Props) {
  const [form, setForm] = useState({
    maxPositionSizeUsd: profile.maxPositionSizeUsd,
    maxOpenPositions: profile.maxOpenPositions,
    copyPercentage: profile.copyPercentage,
    minOdds: profile.minOdds,
    maxOdds: profile.maxOdds,
  });

  const update = useUpdateCopyProfile();

  const handleSave = () => {
    update.mutate(form);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Guardrails</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
            Max Position Size (USD)
          </label>
          <input
            type="number"
            value={form.maxPositionSizeUsd}
            onChange={(e) => setForm((f) => ({ ...f, maxPositionSizeUsd: Number(e.target.value) }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
            Max Open Positions
          </label>
          <input
            type="number"
            value={form.maxOpenPositions}
            onChange={(e) => setForm((f) => ({ ...f, maxOpenPositions: Number(e.target.value) }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
            Copy Percentage
          </label>
          <input
            type="number"
            value={form.copyPercentage}
            onChange={(e) => setForm((f) => ({ ...f, copyPercentage: Number(e.target.value) }))}
            min={1}
            max={100}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
            Min Odds
          </label>
          <input
            type="number"
            step="0.01"
            value={form.minOdds}
            onChange={(e) => setForm((f) => ({ ...f, minOdds: Number(e.target.value) }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
            Max Odds
          </label>
          <input
            type="number"
            step="0.01"
            value={form.maxOdds}
            onChange={(e) => setForm((f) => ({ ...f, maxOdds: Number(e.target.value) }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={update.isPending}
        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {update.isPending ? 'Saving...' : 'Save Guardrails'}
      </button>
    </div>
  );
}
