import React from 'react';
import { signalCheck } from '../../../utils/signalLabels';
import { AI_CATEGORY, CATEGORIES, fmtPts, humanize, level } from './utils';

// Unchecked part is hatched so "could not be checked" never reads as "failed".
const HATCH = { backgroundImage: 'repeating-linear-gradient(45deg, #E5E7EB, #E5E7EB 4px, #F3F4F6 4px, #F3F4F6 8px)' };

const AI_SHORT = { cluster_presence: 'topics cited in', cluster_dominance: 'topics not outnumbered', prompt_citation: 'questions cited' };

function TriBar({ cat }) {
  const full = cat.full || 1;
  return (
    <div className="h-3 rounded-full overflow-hidden flex" style={HATCH}>
      <div className="bg-green-500 h-full" style={{ width: `${(cat.earned / full) * 100}%` }} />
      <div className="bg-red-300 h-full" style={{ width: `${((cat.analysed - cat.earned) / full) * 100}%` }} />
    </div>
  );
}

function Cell({ cat, isAi }) {
  if (!cat || !(cat.analysed > 0)) {
    return (
      <div>
        <p className="text-sm font-semibold text-gray-400">Not checked</p>
        <div className="h-3 rounded-full mt-1.5" style={HATCH} />
        <p className="text-[11px] text-gray-400 mt-1">{isAi ? 'No stored AI answers' : 'Blocked or unavailable'}</p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-black ${level(cat.score_pct).text}`}>{Math.round(cat.score_pct)}%</span>
        <span className="text-[11px] text-gray-400">scored</span>
      </div>
      <div className="mt-1.5"><TriBar cat={cat} /></div>
      <p className="text-[11px] text-gray-600 mt-1.5">
        {fmtPts(cat.earned)} of {fmtPts(cat.analysed)} points · checked {Math.round(cat.coverage_pct)}%
      </p>
      {isAi ? (
        <ul className="text-[11px] text-gray-400 mt-0.5">
          {cat.signals.map(sg => <li key={sg.signal_name}>{sg.passed}/{sg.total} {AI_SHORT[sg.signal_name] || humanize(sg.signal_name)}</li>)}
        </ul>
      ) : (
        <p className="text-[11px] text-gray-400 mt-0.5">{cat.passed} passed, {cat.failed} failed</p>
      )}
    </div>
  );
}

// One row per category, one column per brand: the score each brand earned and how much of the category could be checked.
export default function ScoreByCategory({ sites }) {
  const hasAi = sites.some(s => s.ai);
  const rows = hasAi ? [...CATEGORIES, AI_CATEGORY] : CATEGORIES;
  const aiChecks = sites.find(s => s.ai)?.ai.signals || [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500" />Points earned</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-300" />Checked, not earned</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={HATCH} />Not checked</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse w-full" style={{ minWidth: `${250 + sites.length * 190}px` }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="py-3 px-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-64 min-w-[16rem]">Category</th>
                {sites.map(site => (
                  <th key={site.id} className="py-3 px-4 text-left min-w-[11.5rem]">
                    <span className="flex items-center gap-2 text-sm font-bold" style={{ color: site.color }}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: site.color }} />
                      <span className="truncate max-w-[9rem]" title={site.name}>{site.name}</span>
                      {site.isBrand && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">YOU</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((def) => {
                const isAi = def.key === 'ai_visibility';
                return (
                  <tr key={def.key} className="border-b border-gray-100 last:border-0 align-top">
                    <th scope="row" className="py-4 px-4 text-left font-normal sticky left-0 bg-white z-10 w-64 min-w-[16rem]">
                      <h4 className="font-bold text-gray-900">{def.label}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{def.blurb}</p>
                      {isAi && (
                        <ul className="mt-2 space-y-1 text-[11px] text-gray-500">
                          {aiChecks.map(sg => (
                            <li key={sg.signal_name}><b className="text-gray-700">{humanize(sg.signal_name)}</b> ({sg.weight} pts) – {signalCheck(sg.signal_name) || sg.label}</li>
                          ))}
                        </ul>
                      )}
                    </th>
                    {sites.map(site => (
                      <td key={site.id} className="py-4 px-4">
                        <Cell isAi={isAi} cat={isAi ? site.ai : site.summary?.categories.find(c => c.key === def.key)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!hasAi && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
          LLM Brand Analysis is not shown because this audit has no stored AI answers, so the brands cannot be scored on the same questions. Run a new audit to get it.
        </p>
      )}
    </div>
  );
}
