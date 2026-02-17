'use client';

import { useState, useEffect } from 'react';
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
  const [saved, setSaved] = useState(false);

  const update = useUpdateCopyProfile();

  // Clear saved indicator after 3 seconds
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  const handleSave = () => {
    update.mutate(form, {
      onSuccess: () => setSaved(true),
    });
  };

  return (
    <div className="card p-6">
      <h3 className="mb-4 section-title">Guardrails</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { key: 'maxPositionSizeUsd', label: 'Max Position Size (USD)' },
          { key: 'maxOpenPositions', label: 'Max Open Positions' },
          { key: 'copyPercentage', label: 'Copy Percentage', min: 1, max: 100 },
          { key: 'minOdds', label: 'Min Odds', step: 0.01 },
          { key: 'maxOdds', label: 'Max Odds', step: 0.01 },
        ].map(({ key, label, min, max, step }) => (
          <div key={key}>
            <label className="mb-1.5 block text-sm text-[--text-secondary]">{label}</label>
            <input
              type="number"
              value={(form as any)[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
              min={min}
              max={max}
              step={step}
              className="input-field"
            />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={handleSave} disabled={update.isPending} className="btn-primary">
          {update.isPending ? 'Saving...' : 'Save Guardrails'}
        </button>
        {saved && (
          <span className="text-sm text-[--accent-green]">Saved</span>
        )}
        {update.isError && (
          <span className="text-sm text-[--accent-red]">
            {update.error instanceof Error ? update.error.message : 'Failed to save'}
          </span>
        )}
      </div>
    </div>
  );
}
