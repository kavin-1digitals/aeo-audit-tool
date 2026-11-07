import React, { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import FactsTable from './FactsTable';
import SignalMatrix from './SignalMatrix';

const TABS = [
  { id: 'facts', label: 'Technical facts', hint: 'robots.txt, llms.txt, sitemap, crawler access' },
  { id: 'signals', label: 'Signal by signal', hint: 'every check, pass-rate per site' },
];

// Everything behind the story, one click away so the main flow stays short.
export default function DetailPanel({ sites }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setOpen(open === t.id ? null : t.id)}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
              open === t.id ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300'
            }`}
          >
            {t.label}
            <span className={`text-xs font-normal hidden sm:inline ${open === t.id ? 'text-rose-100' : 'text-gray-400'}`}>{t.hint}</span>
            <ChevronDownIcon className={`h-4 w-4 transition-transform ${open === t.id ? 'rotate-180' : ''}`} />
          </button>
        ))}
      </div>
      {open === 'facts' && <FactsTable sites={sites} />}
      {open === 'signals' && <SignalMatrix sites={sites} />}
    </div>
  );
}
