import React, { useState } from 'react';
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const OTHER = '__other__';

// Competitor name (dropdown of known competitors, or "Other" to type one) + domain.
// geo / site types are NOT asked: they come from the brand's audit on the server.
export default function AddCompetitorForm({ options = [], limit, activeCount, busy, onAdd }) {
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');
  const [domain, setDomain] = useState('');

  const name = (selected === OTHER ? custom : selected).trim();
  const full = activeCount >= limit;
  const canSubmit = name && domain.trim() && !busy && !full;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const ok = await onAdd({ name, domain: domain.trim() });
    if (ok) {
      setSelected('');
      setCustom('');
      setDomain('');
    }
  };

  const inputCls = 'w-full px-4 py-3 bg-white/10 text-white placeholder-rose-300 border border-white/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/40';

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-rose-100 mb-1">Competitor</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className={`${inputCls} text-white`}>
            <option value="" className="text-gray-900">Select a competitor…</option>
            {options.map((o) => (
              <option key={o.name} value={o.name} className="text-gray-900">
                {o.name}{o.added ? '  ✓ added' : ''}
              </option>
            ))}
            <option value={OTHER} className="text-gray-900">Other (type a name)…</option>
          </select>
          {selected === OTHER && (
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Competitor brand name, exactly as it is written"
              className={`${inputCls} mt-2`}
              autoFocus
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-rose-100 mb-1">Website</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="https://competitor.com"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-rose-200">
          Uses your audit&apos;s site type and region. {activeCount}/{limit} competitors added.
          {full && ' Remove one to add another.'}
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-2 px-5 py-3 bg-white text-rose-700 font-bold text-sm rounded-xl hover:bg-rose-50 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {busy ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <MagnifyingGlassIcon className="h-4 w-4" />}
          {busy ? 'Adding…' : 'Audit competitor'}
        </button>
      </div>
    </form>
  );
}
