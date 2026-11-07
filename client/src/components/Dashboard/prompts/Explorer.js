import React, { useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import AnswerView from './AnswerView';

const Cell = ({ m }) => (
  <span className="inline-flex gap-0.5" title={m?.web && m?.llm ? 'web + model' : m?.web ? 'web answer only' : m?.llm ? 'model answer only' : 'not mentioned'}>
    <span className={`w-2.5 h-2.5 rounded-full ${m?.web ? 'bg-green-500' : 'bg-gray-200'}`} />
    <span className={`w-2.5 h-2.5 rounded-full ${m?.llm ? 'bg-violet-500' : 'bg-gray-200'}`} />
  </span>
);

// Step 4: every prompt against every brand (dots = web answer / model answer), searchable, answers on click.
export default function Explorer({ analysis, entities }) {
  const [q, setQ] = useState('');
  const [openIdx, setOpenIdx] = useState(null);
  const rows = useMemo(() => analysis.classified.filter(p => !q || p.prompt.toLowerCase().includes(q.toLowerCase())), [analysis, q]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[12rem]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg" />
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />web answer</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-500" />model answer</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse w-full" style={{ minWidth: `${340 + entities.length * 96}px` }}>
          <thead>
            <tr className="border-b border-gray-100 text-xs">
              <th className="py-2 px-4 text-left font-medium text-gray-500 sticky left-0 bg-white z-10 min-w-[20rem]">Prompt</th>
              {entities.map((e, i) => (
                <th key={e.name} className={`py-2 px-3 text-center font-semibold min-w-[6rem] ${i === 0 ? 'text-blue-700' : 'text-gray-600'}`}>
                  <div className="truncate max-w-[6rem] mx-auto" title={e.name}>{i === 0 ? `${e.name} (you)` : e.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <React.Fragment key={p.index}>
                <tr onClick={() => setOpenIdx(openIdx === p.index ? null : p.index)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                  <td className="py-2 px-4 sticky left-0 bg-white z-10">
                    <span className="text-[10px] font-semibold text-indigo-700 block">{p.cluster}</span>
                    <span className="text-xs text-gray-800">{p.prompt}</span>
                  </td>
                  {entities.map(e => <td key={e.name} className="py-2 px-3 text-center"><Cell m={p.mentions[e.name]} /></td>)}
                </tr>
                {openIdx === p.index && (
                  <tr><td colSpan={entities.length + 1} className="px-4 pb-4 bg-white"><AnswerView prompt={p} brand={analysis.brand} rivals={analysis.rivals} /></td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No prompt matches “{q}”.</p>}
    </div>
  );
}
