import React, { useState, useMemo } from 'react';
import {
  BeakerIcon, ArrowTrendingUpIcon, ArrowPathIcon,
  CheckCircleIcon, XCircleIcon, LightBulbIcon,
} from '@heroicons/react/24/outline';

const SIGNAL_WEIGHTS = {
  cluster_presence: 12, cluster_dominance: 12, prompt_citation: 16,
  llms_txt_exists: 4, llms_txt_valid: 3, llms_txt_enriched: 3,
  robots_txt_exists: 3,
  sitemap_exists: 3, sitemap_type_valid: 3, sitemap_freshness: 3,
  ai_crawler_access: 4, search_crawler_access: 4,
  site_scrapable: 6,
  canonical_exists: 4, canonical_matches: 3, canonical_clean: 3,
  jsonld_exists: 3, jsonld_valid: 3,
  og_tags_exists: 3, og_tags_complete: 2, twitter_card_exists: 1, page_indexable: 2,
};

const CATEGORY_MAP = {
  cluster_presence: 'llm_signals', cluster_dominance: 'llm_signals', prompt_citation: 'llm_signals',
  llms_txt_exists: 'domain_signals', llms_txt_valid: 'domain_signals', llms_txt_enriched: 'domain_signals',
  robots_txt_exists: 'domain_signals',
  sitemap_exists: 'domain_signals', sitemap_type_valid: 'domain_signals', sitemap_freshness: 'domain_signals',
  ai_crawler_access: 'domain_signals', search_crawler_access: 'domain_signals',
  site_scrapable: 'site_signals',
  canonical_exists: 'site_signals', canonical_matches: 'site_signals', canonical_clean: 'site_signals',
  jsonld_exists: 'site_signals', jsonld_valid: 'site_signals',
  og_tags_exists: 'site_signals', og_tags_complete: 'site_signals', twitter_card_exists: 'site_signals', page_indexable: 'site_signals',
};

const CATEGORY_LABEL = { llm_signals: 'LLM Brand', domain_signals: 'Domain', site_signals: 'Site' };
const CATEGORY_COLOR = { llm_signals: 'purple', domain_signals: 'blue', site_signals: 'green' };

const fmt = (n) => parseFloat((n || 0).toFixed(1));

function calcScore(scores, overrides = {}) {
  const grouped = {};
  scores.forEach(s => {
    if (!grouped[s.signal_name]) grouped[s.signal_name] = [];
    grouped[s.signal_name].push(s);
  });

  let totalWeight = 0, totalScore = 0;
  Object.entries(SIGNAL_WEIGHTS).forEach(([sig, weight]) => {
    const list = grouped[sig];
    if (!list) return;
    const isFixed = overrides[sig];
    const positive = isFixed
      ? list.length
      : list.filter(s => s.value > 0).length;
    const pct = (positive / list.length) * 100;
    const weighted = (pct * weight) / 100;
    totalWeight += weight;
    totalScore += weighted;
  });

  return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
}

export default function ScoreSimulator({ auditData }) {
  const scores = auditData?.raw_scorecard?.scores || [];
  const currentScore = fmt(auditData?.audit_metadata?.percentage || auditData?.audit_metadata?.score_percentage || 0);

  // Unique failed signal names
  const failedSignals = useMemo(() => {
    const seen = new Set();
    return scores
      .filter(s => s.value < 0)
      .filter(s => {
        if (seen.has(s.signal_name)) return false;
        seen.add(s.signal_name);
        return true;
      })
      .map(s => ({
        name: s.signal_name,
        label: s.signal_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        weight: SIGNAL_WEIGHTS[s.signal_name] || 1,
        category: CATEGORY_MAP[s.signal_name] || 'site_signals',
        count: scores.filter(x => x.signal_name === s.signal_name && x.value < 0).length,
      }))
      .sort((a, b) => b.weight - a.weight);
  }, [scores]);

  const [fixed, setFixed] = useState({});

  const simScore = useMemo(() => fmt(calcScore(scores, fixed)), [scores, fixed]);
  const gain = fmt(simScore - currentScore);

  const toggle = (name) => setFixed(f => ({ ...f, [name]: !f[name] }));
  const fixAll = () => {
    const all = {};
    failedSignals.forEach(s => { all[s.name] = true; });
    setFixed(all);
  };
  const reset = () => setFixed({});

  const fixedCount = Object.values(fixed).filter(Boolean).length;

  if (failedSignals.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <div className="bg-green-100 rounded-full p-6 inline-block mb-4">
          <CheckCircleIcon className="h-12 w-12 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No failing signals to simulate</h3>
        <p className="text-gray-500">All signals are passing — great work!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Score display */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <BeakerIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">Score Simulator</h2>
            <p className="text-indigo-200 text-sm">Toggle fixes to see your potential score in real-time</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black">{currentScore}%</div>
            <div className="text-indigo-200 text-xs mt-1">Current Score</div>
          </div>
          <div className={`rounded-xl p-4 text-center transition-all ${gain > 0 ? 'bg-green-500/30' : 'bg-white/10'}`}>
            <div className={`text-3xl font-black ${gain > 0 ? 'text-green-300' : 'text-white/50'}`}>
              {gain > 0 ? `+${gain}%` : '—'}
            </div>
            <div className="text-indigo-200 text-xs mt-1">Simulated Gain</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className={`text-3xl font-black ${simScore > currentScore ? 'text-green-300' : ''}`}>
              {simScore}%
            </div>
            <div className="text-indigo-200 text-xs mt-1">Simulated Score</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-4 relative">
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white/50 rounded-full transition-all duration-500" style={{ width: `${currentScore}%` }} />
          </div>
          {simScore > currentScore && (
            <div className="absolute top-0 h-3 bg-green-400 rounded-r-full transition-all duration-500"
              style={{ left: `${currentScore}%`, width: `${simScore - currentScore}%` }} />
          )}
          <div className="flex justify-between text-xs text-indigo-300 mt-1">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-bold text-gray-900">{fixedCount}</span> of {failedSignals.length} fixes toggled
        </p>
        <div className="flex gap-2">
          <button onClick={fixAll} className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors">
            Fix All
          </button>
          <button onClick={reset} className="text-xs font-semibold px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1">
            <ArrowPathIcon className="h-3 w-3" /> Reset
          </button>
        </div>
      </div>

      {/* Signal toggles */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600 px-1">Click a signal to simulate fixing it:</p>
        {failedSignals.map(sig => {
          const isFixed = !!fixed[sig.name];
          const col = CATEGORY_COLOR[sig.category];
          const scoreGain = fmt(calcScore(scores, { ...fixed, [sig.name]: true }) - (isFixed ? calcScore(scores, { ...fixed, [sig.name]: false }) + 0 : simScore));
          return (
            <button
              key={sig.name}
              onClick={() => toggle(sig.name)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                isFixed
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                isFixed ? 'bg-green-500 border-green-500' : 'border-gray-300'
              }`}>
                {isFixed && <CheckCircleIcon className="h-3.5 w-3.5 text-white" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${isFixed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {sig.label}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold bg-${col}-100 text-${col}-700`}>
                    {CATEGORY_LABEL[sig.category]}
                  </span>
                  {sig.count > 1 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{sig.count} pages</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className={`text-sm font-black ${isFixed ? 'text-green-600' : 'text-gray-400'}`}>
                    {isFixed ? '✓ Fixed' : `+${sig.weight} pts`}
                  </div>
                </div>
                <ArrowTrendingUpIcon className={`h-4 w-4 ${isFixed ? 'text-green-400' : 'text-gray-300'}`} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
        <LightBulbIcon className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-700 leading-relaxed">
          This simulator shows an <strong>estimate</strong> based on the scoring weights. Actual score changes depend on how many pages are affected and whether the fix fully resolves the signal. Run a new audit after making changes to get the real score.
        </p>
      </div>
    </div>
  );
}
