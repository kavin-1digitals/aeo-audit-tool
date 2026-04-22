import React, { useState } from 'react';
import {
  ChartBarIcon, TrophyIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
  MinusIcon, BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

const INDUSTRIES = {
  saas: {
    label: 'SaaS / Software',
    icon: '💻',
    benchmarks: { overall: 62, llm_signals: 55, domain_signals: 68, site_signals: 63 },
    topSignals: ['cluster_presence', 'prompt_citation', 'jsonld_exists'],
  },
  ecommerce: {
    label: 'E-Commerce',
    icon: '🛍️',
    benchmarks: { overall: 48, llm_signals: 38, domain_signals: 54, site_signals: 52 },
    topSignals: ['og_tags_exists', 'canonical_exists', 'site_scrapable'],
  },
  healthcare: {
    label: 'Healthcare',
    icon: '🏥',
    benchmarks: { overall: 51, llm_signals: 44, domain_signals: 56, site_signals: 53 },
    topSignals: ['jsonld_exists', 'page_indexable', 'llms_txt_exists'],
  },
  finance: {
    label: 'Finance / Fintech',
    icon: '🏦',
    benchmarks: { overall: 57, llm_signals: 52, domain_signals: 62, site_signals: 57 },
    topSignals: ['cluster_presence', 'canonical_exists', 'robots_txt_exists'],
  },
  media: {
    label: 'Media / Publishing',
    icon: '📰',
    benchmarks: { overall: 71, llm_signals: 78, domain_signals: 65, site_signals: 70 },
    topSignals: ['prompt_citation', 'cluster_dominance', 'og_tags_complete'],
  },
  agency: {
    label: 'Agency / Consulting',
    icon: '🏢',
    benchmarks: { overall: 54, llm_signals: 48, domain_signals: 59, site_signals: 55 },
    topSignals: ['cluster_presence', 'site_scrapable', 'jsonld_exists'],
  },
  education: {
    label: 'Education / EdTech',
    icon: '🎓',
    benchmarks: { overall: 60, llm_signals: 64, domain_signals: 57, site_signals: 59 },
    topSignals: ['prompt_citation', 'sitemap_exists', 'page_indexable'],
  },
  local: {
    label: 'Local Business',
    icon: '📍',
    benchmarks: { overall: 39, llm_signals: 28, domain_signals: 44, site_signals: 45 },
    topSignals: ['og_tags_exists', 'jsonld_exists', 'robots_txt_exists'],
  },
};

const CATEGORY_LABELS = {
  llm_signals: 'LLM Brand', domain_signals: 'Domain', site_signals: 'Site', overall: 'Overall',
};

const fmt = (n) => parseFloat((n || 0).toFixed(1));

function getDelta(score, benchmark) {
  const d = fmt(score - benchmark);
  return d;
}

const DeltaBadge = ({ delta }) => {
  if (delta > 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
      <ArrowTrendingUpIcon className="h-3 w-3" />+{delta}%
    </span>
  );
  if (delta < 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
      <ArrowTrendingDownIcon className="h-3 w-3" />{delta}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      <MinusIcon className="h-3 w-3" />At par
    </span>
  );
};

function ScoreBar({ score, benchmark, color = 'blue' }) {
  const max = Math.max(score, benchmark, 100);
  const colorMap = {
    blue: 'bg-blue-500', purple: 'bg-purple-500', green: 'bg-green-500', indigo: 'bg-indigo-500',
  };
  return (
    <div className="relative h-3 bg-gray-100 rounded-full overflow-visible mt-1">
      <div
        className={`absolute top-0 left-0 h-full rounded-full ${colorMap[color] || 'bg-blue-500'} transition-all duration-700`}
        style={{ width: `${Math.min(score, 100)}%` }}
      />
      <div
        className="absolute top-[-3px] h-5 w-0.5 bg-gray-500 rounded"
        style={{ left: `${Math.min(benchmark, 100)}%` }}
        title={`Industry avg: ${benchmark}%`}
      />
    </div>
  );
}

export default function IndustryBenchmarks({ auditData }) {
  const [selected, setSelected] = useState('saas');

  const meta = auditData?.audit_metadata || {};
  const scores = auditData?.raw_scorecard?.scores || [];
  const overall = fmt(meta.percentage || meta.score_percentage || 0);

  const getCategoryScore = (cat) => {
    const catScores = scores.filter(s => {
      if (cat === 'llm_signals') return ['cluster_presence', 'cluster_dominance', 'prompt_citation'].includes(s.signal_name);
      if (cat === 'domain_signals') return ['llms_txt_exists', 'llms_txt_valid', 'llms_txt_enriched', 'robots_txt_exists', 'sitemap_exists', 'sitemap_type_valid', 'sitemap_freshness', 'ai_crawler_access', 'search_crawler_access'].includes(s.signal_name);
      if (cat === 'site_signals') return ['site_scrapable', 'canonical_exists', 'canonical_matches', 'canonical_clean', 'jsonld_exists', 'jsonld_valid', 'og_tags_exists', 'og_tags_complete', 'twitter_card_exists', 'page_indexable'].includes(s.signal_name);
      return false;
    });
    if (!catScores.length) return 0;
    const passing = catScores.filter(s => s.value > 0).length;
    return fmt((passing / catScores.length) * 100);
  };

  const myScores = {
    overall,
    llm_signals: getCategoryScore('llm_signals'),
    domain_signals: getCategoryScore('domain_signals'),
    site_signals: getCategoryScore('site_signals'),
  };

  const industry = INDUSTRIES[selected];
  const bench = industry.benchmarks;

  const radarData = [
    { subject: 'Overall', You: myScores.overall, Industry: bench.overall },
    { subject: 'LLM Brand', You: myScores.llm_signals, Industry: bench.llm_signals },
    { subject: 'Domain', You: myScores.domain_signals, Industry: bench.domain_signals },
    { subject: 'Site', You: myScores.site_signals, Industry: bench.site_signals },
  ];

  const overallDelta = getDelta(overall, bench.overall);
  const rank = overallDelta >= 10 ? 'Top Performer' : overallDelta >= 0 ? 'Above Average' : overallDelta >= -10 ? 'Below Average' : 'Needs Work';
  const rankColor = overallDelta >= 10 ? 'text-green-700 bg-green-100' : overallDelta >= 0 ? 'text-blue-700 bg-blue-100' : overallDelta >= -10 ? 'text-orange-700 bg-orange-100' : 'text-red-700 bg-red-100';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <ChartBarIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">Industry Benchmarks</h2>
            <p className="text-emerald-200 text-sm">See how your score compares to industry averages</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'overall', label: 'Overall', color: 'bg-white/10' },
            { key: 'llm_signals', label: 'LLM Brand', color: 'bg-purple-500/30' },
            { key: 'domain_signals', label: 'Domain', color: 'bg-blue-500/30' },
            { key: 'site_signals', label: 'Site', color: 'bg-green-500/30' },
          ].map(({ key, label, color }) => (
            <div key={key} className={`${color} rounded-xl p-3 text-center`}>
              <div className="text-2xl font-black">{myScores[key]}%</div>
              <div className="text-emerald-200 text-xs mt-0.5">{label}</div>
              <DeltaBadge delta={getDelta(myScores[key], bench[key])} />
            </div>
          ))}
        </div>
      </div>

      {/* Industry selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <BuildingOfficeIcon className="h-4 w-4" />
          Select your industry
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(INDUSTRIES).map(([key, ind]) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left text-sm transition-all ${
                selected === key
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 bg-white hover:border-emerald-300'
              }`}
            >
              <span className="text-lg">{ind.icon}</span>
              <span className={`font-semibold text-xs leading-tight ${selected === key ? 'text-emerald-800' : 'text-gray-700'}`}>
                {ind.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Radar chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Score Radar</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Radar name="You" dataKey="You" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
              <Radar name={industry.label} dataKey="Industry" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} strokeDasharray="4 2" />
              <Tooltip formatter={(v) => `${v}%`} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-indigo-500 inline-block rounded" />You</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded border-dashed" />Industry avg</span>
          </div>
        </div>

        {/* Bar comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Category Breakdown</h3>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${rankColor}`}>
              <TrophyIcon className="h-3 w-3 inline mr-1" />{rank}
            </span>
          </div>
          {[
            { key: 'overall', label: 'Overall Score', color: 'indigo' },
            { key: 'llm_signals', label: 'LLM Brand Signals', color: 'purple' },
            { key: 'domain_signals', label: 'Domain Signals', color: 'blue' },
            { key: 'site_signals', label: 'Site Signals', color: 'green' },
          ].map(({ key, label, color }) => (
            <div key={key}>
              <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                <span className="font-medium">{label}</span>
                <span className="font-bold">{myScores[key]}% <span className="font-normal text-gray-400">vs {bench[key]}%</span></span>
              </div>
              <ScoreBar score={myScores[key]} benchmark={bench[key]} color={color} />
            </div>
          ))}
          <p className="text-xs text-gray-400 mt-2">
            <span className="inline-block w-0.5 h-4 bg-gray-500 mr-1 align-middle" />vertical line = industry average
          </p>
        </div>
      </div>

      {/* Key insight */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-bold text-amber-800 mb-2">
          {industry.icon} {industry.label} — Key AEO signals to focus on
        </p>
        <div className="flex flex-wrap gap-2">
          {industry.topSignals.map(sig => (
            <span key={sig} className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full border border-amber-200">
              {sig.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          ))}
        </div>
        <p className="text-xs text-amber-700 mt-2 leading-relaxed">
          Benchmarks are based on aggregated scores from publicly audited sites in this industry. Your actual competitive position may vary.
        </p>
      </div>
    </div>
  );
}
