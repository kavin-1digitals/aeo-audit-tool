import React, { useMemo, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import AnswerView from './AnswerView';
import { reasons } from './utils';

const PAGE = 8;

function Card({ item, rank, analysis }) {
  const [open, setOpen] = useState(false);
  const why = reasons(item, analysis.clusterStats);
  return (
    <li className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <span className="flex-none w-7 h-7 rounded-full bg-red-50 text-red-600 text-xs font-bold flex items-center justify-center">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{item.cluster}</span>
            {item.winners.map(w => (
              <span key={w.name} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-100" title={w.both ? 'Named in the web and the model answer' : w.web ? 'Named in the web answer' : 'Named in the model answer'}>
                <b>{w.name}</b> <span className="text-amber-600">{w.both ? 'web + model' : w.web ? 'web' : 'model'}</span>
              </span>
            ))}
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-snug">{item.prompt}</p>
          {why.length > 0 && <p className="text-xs text-gray-500 mt-1">Ranked high because: {why.join(' · ')}</p>}
          <button onClick={() => setOpen(!open)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800">
            {open ? 'Hide' : 'See'} what AI answered
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && <AnswerView prompt={item} brand={analysis.brand} rivals={item.winners.map(w => w.name)} />}
        </div>
      </div>
    </li>
  );
}

// Step 2: prompts where competitors are recommended and you are not - ranked, filterable, with the answer behind it.
export default function Opportunities({ analysis }) {
  const [cluster, setCluster] = useState('All');
  const [rival, setRival] = useState('All');
  const [shown, setShown] = useState(PAGE);

  const clusters = useMemo(() => ['All', ...analysis.clusterStats.map(c => c.cluster)], [analysis]);
  const rivals = useMemo(() => ['All', ...analysis.rivalBoard.filter(r => r.whereYouMissed > 0).map(r => r.name)], [analysis]);
  const list = analysis.missed.filter(p => (cluster === 'All' || p.cluster === cluster) && (rival === 'All' || p.winners.some(w => w.name === rival)));

  if (!analysis.missed.length) {
    return <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-2xl p-5">No missed prompts – wherever a competitor is recommended, you are too.</p>;
  }

  const select = (value, set, options) => (
    <select value={value} onChange={(e) => { set(e.target.value); setShown(PAGE); }} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
      {options.map(o => <option key={o} value={o}>{o === 'All' ? `All ${set === setCluster ? 'topics' : 'competitors'}` : o}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {select(cluster, setCluster, clusters)}
        {select(rival, setRival, rivals)}
        <span className="text-xs text-gray-400">{list.length} of {analysis.missed.length} missed prompts · biggest opportunity first</span>
      </div>
      {list.length === 0
        ? <p className="text-sm text-gray-500 bg-gray-50 rounded-2xl p-5">No missed prompts for this filter.</p>
        : <ul className="space-y-3">{list.slice(0, shown).map((item, i) => <Card key={item.index} item={item} rank={i + 1} analysis={analysis} />)}</ul>}
      {list.length > shown && (
        <button onClick={() => setShown(shown + PAGE)} className="w-full text-sm font-semibold text-violet-600 hover:text-violet-800 py-2">
          Show {Math.min(PAGE, list.length - shown)} more
        </button>
      )}
    </div>
  );
}
