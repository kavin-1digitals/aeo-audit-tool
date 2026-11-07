import React from 'react';
import { pct } from './utils';

function Meter({ label, value, hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-sm font-bold text-gray-900">{pct(value)}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-violet-500 rounded-full" style={{ width: pct(value) }} /></div>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// Step 1: where you stand - overall, per answer type, per topic cluster against the strongest competitor.
export default function Standing({ analysis }) {
  const { total, won, missed, open, rate, clusterStats, brand, rivalBoard } = analysis;
  const stat = (n, label, cls) => (
    <div className={`rounded-xl p-4 text-center ${cls}`}><div className="text-3xl font-black">{n}</div><div className="text-xs font-medium mt-1">{label}</div></div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:col-span-1 space-y-4">
          <div>
            <p className="text-xs text-gray-500">{brand} is recommended in</p>
            <p className="text-3xl font-black text-gray-900">{won.length}<span className="text-lg text-gray-400 font-semibold"> of {total} prompts</span></p>
          </div>
          <Meter label="Web search answers" value={rate.web} hint="what AI says when it can search the web" />
          <Meter label="AI model answers" value={rate.llm} hint="what AI says from its own knowledge" />
        </div>

        <div className="lg:col-span-2 grid grid-cols-3 gap-3 content-start">
          {stat(won.length, 'You are mentioned', 'bg-green-50 text-green-700')}
          {stat(missed.length, 'Competitors win, not you', 'bg-red-50 text-red-700')}
          {stat(open.length, 'Nobody is mentioned', 'bg-gray-100 text-gray-600')}
          {rivalBoard.length > 0 && (
            <div className="col-span-3 bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Most recommended competitors</p>
              <div className="flex flex-wrap gap-2">
                {rivalBoard.slice(0, 6).map(r => (
                  <span key={r.name} className="text-xs bg-amber-50 text-amber-900 border border-amber-100 rounded-full px-3 py-1" title={`Named in ${r.prompts} prompts; you missed ${r.whereYouMissed} of them`}>
                    <b>{r.name}</b> · {r.prompts} prompts{r.whereYouMissed ? ` (${r.whereYouMissed} without you)` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h4 className="font-bold text-gray-900">By topic cluster</h4>
        <p className="text-xs text-gray-500 mb-4">Share of prompts in each topic where you (blue) and the strongest competitor (amber) are mentioned</p>
        <ul className="space-y-4">
          {clusterStats.map(c => (
            <li key={c.cluster}>
              <div className="flex items-baseline justify-between mb-1 gap-3">
                <span className="text-sm font-semibold text-gray-800">{c.cluster}</span>
                <span className="text-xs text-gray-400">{c.total} prompts</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: pct(c.youRate) }} /></div>
                  <span className="text-xs font-bold text-blue-700 w-10 text-right">{pct(c.youRate)}</span>
                  <span className="text-[11px] text-gray-400 w-28 truncate">You</span>
                </div>
                {c.bestRival && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400" style={{ width: pct(c.bestRivalRate) }} /></div>
                    <span className="text-xs font-bold text-amber-700 w-10 text-right">{pct(c.bestRivalRate)}</span>
                    <span className="text-[11px] text-gray-400 w-28 truncate" title={c.bestRival}>{c.bestRival}</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
