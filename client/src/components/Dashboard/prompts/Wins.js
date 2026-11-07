import React, { useState } from 'react';
import AnswerView from './AnswerView';

// Step 3: prompts where you are mentioned - compact, expandable.
export default function Wins({ analysis }) {
  const [openIdx, setOpenIdx] = useState(null);
  if (!analysis.won.length) return <p className="text-sm text-gray-500 bg-gray-50 rounded-2xl p-5">You are not mentioned in any prompt yet.</p>;
  return (
    <ul className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
      {analysis.won.map((p) => (
        <li key={p.index} className="px-4 py-3">
          <button onClick={() => setOpenIdx(openIdx === p.index ? null : p.index)} className="w-full text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-indigo-700">{p.cluster}</span>
                <p className="text-sm text-gray-900">{p.prompt}</p>
              </div>
              <span className="flex-none flex gap-1 text-[10px] font-bold">
                <span className={`px-1.5 py-0.5 rounded ${p.you.web ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>web</span>
                <span className={`px-1.5 py-0.5 rounded ${p.you.llm ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>model</span>
              </span>
            </div>
          </button>
          {openIdx === p.index && <AnswerView prompt={p} brand={analysis.brand} rivals={p.winners.map(w => w.name)} />}
        </li>
      ))}
    </ul>
  );
}
