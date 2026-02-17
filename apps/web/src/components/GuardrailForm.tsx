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
      <button onClick={handleSave} disabled={update.isPending} className="btn-primary mt-5">
        {update.isPending ? 'Saving...' : 'Save Guardrails'}
      </button>
    </div>
  );
}
