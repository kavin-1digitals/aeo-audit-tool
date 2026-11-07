import React from 'react';
import { factLabel } from './utils';

const TONE = { good: 'text-green-700', bad: 'text-red-600', warn: 'text-amber-700', muted: 'text-gray-400' };

const ROWS = [
  { label: 'robots.txt', fact: 'robots' },
  { label: 'llms.txt', fact: 'llms_txt' },
  { label: 'Sitemap', fact: 'sitemap' },
  { label: 'AI crawlers', fact: 'ai_crawlers' },
  { label: 'Search crawlers', fact: 'search_crawlers' },
  { label: 'Pages analysed', cell: (s) => s.pages ?? '—' },
  { label: 'Structured data', cell: (s) => (s.facts?.jsonld_types?.length ? s.facts.jsonld_types.join(', ') : s.facts?.site ? 'None found' : '—') },
];

export default function FactsTable({ sites }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse w-full" style={{ minWidth: `${160 + sites.length * 150}px` }}>
          <thead>
            <tr className="border-b border-gray-100 text-xs">
              <th className="py-2 px-4 sticky left-0 bg-white z-10 w-40" />
              {sites.map(s => <th key={s.id} className="py-2 px-3 text-left font-semibold min-w-[9.5rem]" style={{ color: s.color }}><div className="truncate max-w-[9rem]">{s.name}</div></th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => (
              <tr key={row.label} className="border-b border-gray-50">
                <td className="py-2 px-4 text-xs font-medium text-gray-600 sticky left-0 bg-white z-10">{row.label}</td>
                {sites.map((s) => {
                  if (row.fact) {
                    const f = factLabel(row.fact, s.facts);
                    return <td key={s.id} className={`py-2 px-3 text-xs font-medium ${TONE[f.tone]}`} title={f.title}>{f.text}</td>;
                  }
                  return <td key={s.id} className="py-2 px-3 text-xs text-gray-800">{row.cell(s)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
