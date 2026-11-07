import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const KIND = { brand: 'You', added: 'Added by you', discovered: 'Found by AI' };
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(); } catch { return iso; } };
const short = (s) => (s.length > 12 ? `${s.slice(0, 11)}…` : s);

const Part = ({ title, children, text }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
    <h4 className="font-bold text-gray-900">{title}</h4>
    <p className="text-sm text-gray-500 mt-0.5 mb-4 max-w-3xl">{text}</p>
    {children}
  </div>
);

// Step 3. Three parts, in the order a reader asks the questions:
// how many questions and how often each brand was named, which topics those mentions come from,
// and what that adds up to (share among the compared brands, and topic coverage).
export default function MentionsStory({ overview, sites }) {
  const summary = overview?.visibility_summary;
  const scores = overview?.visibility_set || [];
  const references = (overview?.entries || []).filter(e => e.status === 'done' && e.visibility_reference);

  if (!summary) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-sm text-gray-600">
          This audit has no stored AI answers, so competitors cannot be scored on the same questions. Run a new audit to see this section.
        </p>
        {references.length > 0 && (
          <ul className="mt-3 space-y-1">
            {references.map(e => (
              <li key={e.comparison_id} className="text-xs text-gray-500">
                <b>{e.name}</b>: {e.visibility_reference.sov}% share of voice, measured for {e.visibility_reference.measured_for_brand} on{' '}
                {fmtDate(e.visibility_reference.measured_at)} with different questions (reference only).
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const { total_prompts: total, topics } = summary;
  const colors = Object.fromEntries(sites.map(s => [s.name, s.color]));
  const entities = [...summary.entities].sort((a, b) => b.citations - a.citations);
  const scoreOf = Object.fromEntries(scores.map(r => [r.entity, r]));
  const topicsNamed = (name) => summary.clusters.filter(c => c.counts[name] > 0).length;

  const chartData = [...scores].sort((a, b) => b.sov - a.sov).map(r => ({
    name: short(r.entity), full: r.entity, 'Share among compared brands': r.sov, 'Topic coverage': r.cluster_coverage,
  }));

  return (
    <div className="space-y-4">
      {/* Part 1 – totals and citations */}
      <Part
        title="Questions asked and times each brand was named"
        text="Each question was answered twice, once with web search and once by the AI model alone. A citation is a question where the brand appears in at least one of the two answers."
      >
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[[total, 'questions asked'], [topics, 'topics'], [entities.length, 'brands compared']].map(([n, label]) => (
            <div key={label} className="rounded-xl bg-gray-50 px-4 py-3 text-center">
              <div className="text-2xl font-black text-gray-900">{n}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
        <ul className="space-y-4">
          {entities.map((e) => (
            <li key={e.name} className={e.kind === 'brand' ? 'bg-blue-50/60 -mx-2 px-2 py-1.5 rounded-lg' : ''}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {e.name} <span className="ml-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded align-middle">{KIND[e.kind]}</span>
                </span>
                <span className="text-sm whitespace-nowrap"><b className="text-gray-900">{e.citations}</b> <span className="text-gray-400">of {total} questions</span></span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${total ? (e.citations / total) * 100 : 0}%`, backgroundColor: colors[e.name] || '#9CA3AF' }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Web-search answers: {e.web} · AI model answers: {e.llm}</p>
            </li>
          ))}
        </ul>
      </Part>

      {/* Part 2 – per topic */}
      <Part
        title="Mentions by topic"
        text="How many questions in each topic named each brand. The brand named most often in a topic is shown in bold."
      >
        <div className="overflow-x-auto -mx-1">
          <table className="text-sm border-collapse w-full" style={{ minWidth: `${200 + entities.length * 110}px` }}>
            <thead>
              <tr className="border-b border-gray-100 text-xs">
                <th className="py-2 px-3 text-left font-medium text-gray-500 sticky left-0 bg-white z-10 min-w-[12rem]">Topic</th>
                {entities.map(e => (
                  <th key={e.name} className="py-2 px-3 text-center font-semibold min-w-[6.5rem]" style={{ color: colors[e.name] }}>
                    <div className="truncate max-w-[7rem] mx-auto" title={e.name}>{e.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.clusters.map((c) => {
                const top = Math.max(...entities.map(e => c.counts[e.name] || 0));
                return (
                  <tr key={c.cluster} className="border-b border-gray-50">
                    <td className="py-2.5 px-3 sticky left-0 bg-white z-10">
                      <span className="text-sm font-medium text-gray-800">{c.cluster}</span>
                      <span className="block text-[11px] text-gray-400">{c.prompts} question{c.prompts === 1 ? '' : 's'}</span>
                    </td>
                    {entities.map((e) => {
                      const n = c.counts[e.name] || 0;
                      const lead = n > 0 && n === top;
                      return (
                        <td key={e.name} className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block min-w-[3.5rem] rounded-md px-2 py-1 text-xs ${lead ? 'font-bold text-gray-900' : 'text-gray-600'}`}
                            style={{ backgroundColor: `rgba(99, 102, 241, ${c.prompts ? (n / c.prompts) * 0.28 : 0})` }}
                          >
                            {n} of {c.prompts}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Part>

      {/* Part 3 – the scores */}
      <Part
        title="Share among compared brands and topic coverage"
        text={'Share among compared brands: out of all citations of the brands shown here, the part that belongs to this brand. The brands shown add up to 100%. It is not a share of the whole market, and it changes when a competitor is added or removed. Topic coverage: the share of topics in which the brand is cited at least once.'}
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-center">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v}%`} labelFormatter={(_, p) => p?.[0]?.payload?.full} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Share among compared brands" fill="#6366F1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Topic coverage" fill="#14B8A6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <table className="text-sm w-full">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="py-2 pr-3 text-left font-medium">Brand</th>
                <th className="py-2 px-2 text-right font-medium">Share among compared brands</th>
                <th className="py-2 pl-2 text-right font-medium">Topic coverage</th>
              </tr>
            </thead>
            <tbody>
              {[...scores].sort((a, b) => b.sov - a.sov).map(r => (
                <tr key={r.entity} className={`border-b border-gray-50 ${r.kind === 'brand' ? 'bg-blue-50/60' : ''}`}>
                  <td className="py-2 pr-3 font-medium text-gray-800">{r.entity}</td>
                  <td className="py-2 px-2 text-right font-bold text-gray-900">{r.sov}%</td>
                  <td className="py-2 pl-2 text-right text-gray-700">
                    <b>{r.cluster_coverage}%</b> <span className="text-xs text-gray-400">({topicsNamed(r.entity)} of {topics} topics)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!!Object.keys(scoreOf).length && (
          <p className="text-[11px] text-gray-400 mt-4 pt-3 border-t border-gray-100">
            All brands are scored on the same stored answers, so no extra AI calls were made. Adding a competitor changes everyone&apos;s share, because the shares are relative.
          </p>
        )}
      </Part>
    </div>
  );
}
