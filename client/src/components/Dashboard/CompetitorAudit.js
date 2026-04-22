import React, { useState } from 'react';
import {
  MagnifyingGlassIcon, ArrowsRightLeftIcon, CheckCircleIcon,
  XCircleIcon, ArrowPathIcon, ExclamationTriangleIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

const API_BASE = process.env.REACT_APP_API_URL || 'http://127.0.0.1:3003/aeo-audit-tool/api';

const SIGNAL_GROUPS = {
  'LLM Signals': ['cluster_presence', 'cluster_dominance', 'prompt_citation'],
  'Domain Signals': ['llms_txt_exists', 'llms_txt_valid', 'robots_txt_exists', 'sitemap_exists', 'ai_crawler_access', 'search_crawler_access'],
  'Site Signals': ['site_scrapable', 'canonical_exists', 'jsonld_exists', 'og_tags_exists', 'page_indexable'],
};

function calcScore(scores) {
  const WEIGHTS = {
    cluster_presence: 12, cluster_dominance: 12, prompt_citation: 16,
    llms_txt_exists: 4, llms_txt_valid: 3, llms_txt_enriched: 3,
    robots_txt_exists: 3, sitemap_exists: 3, sitemap_type_valid: 3, sitemap_freshness: 3,
    ai_crawler_access: 4, search_crawler_access: 4,
    site_scrapable: 6, canonical_exists: 4, canonical_matches: 3, canonical_clean: 3,
    jsonld_exists: 3, jsonld_valid: 3, og_tags_exists: 3, og_tags_complete: 2,
    twitter_card_exists: 1, page_indexable: 2,
  };
  const grouped = {};
  scores.forEach(s => {
    if (!grouped[s.signal_name]) grouped[s.signal_name] = [];
    grouped[s.signal_name].push(s);
  });
  let totalWeight = 0, totalScore = 0;
  Object.entries(WEIGHTS).forEach(([sig, w]) => {
    const list = grouped[sig];
    if (!list) return;
    const positive = list.filter(s => s.value > 0).length;
    totalWeight += w;
    totalScore += (positive / list.length) * w;
  });
  return totalWeight > 0 ? parseFloat(((totalScore / totalWeight) * 100).toFixed(1)) : 0;
}

function getSignalStatus(scores, signalName) {
  const matching = scores.filter(s => s.signal_name === signalName);
  if (!matching.length) return null;
  const passing = matching.filter(s => s.value > 0).length;
  return passing > 0;
}

const SignalRow = ({ signalName, yourStatus, theirStatus }) => {
  const label = signalName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const StatusIcon = ({ status }) => {
    if (status === null) return <span className="text-gray-300 text-xs">—</span>;
    return status
      ? <CheckCircleIcon className="h-5 w-5 text-green-500" />
      : <XCircleIcon className="h-5 w-5 text-red-400" />;
  };

  const advantage = yourStatus !== null && theirStatus !== null && yourStatus !== theirStatus;
  const youWin = yourStatus && !theirStatus;

  return (
    <tr className={`border-b border-gray-100 ${advantage ? (youWin ? 'bg-green-50' : 'bg-red-50') : ''}`}>
      <td className="py-2.5 px-4 text-xs font-medium text-gray-700">{label}</td>
      <td className="py-2.5 px-4 text-center"><StatusIcon status={yourStatus} /></td>
      <td className="py-2.5 px-4 text-center"><StatusIcon status={theirStatus} /></td>
      <td className="py-2.5 px-4 text-center">
        {advantage && (
          youWin
            ? <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">You win</span>
            : <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">They win</span>
        )}
      </td>
    </tr>
  );
};

export default function CompetitorAudit({ auditData }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [competitorData, setCompetitorData] = useState(null);

  const myScores = auditData?.raw_scorecard?.scores || [];
  const myScore = parseFloat((auditData?.audit_metadata?.percentage || auditData?.audit_metadata?.score_percentage || 0).toFixed(1));
  const myDomain = auditData?.audit_metadata?.domain || auditData?.audit_metadata?.url || 'Your Site';

  const handleAudit = async () => {
    if (!url.trim()) return;
    setError('');
    setLoading(true);
    setCompetitorData(null);
    try {
      const resp = await fetch(`${API_BASE}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!resp.ok) throw new Error(`Audit failed (${resp.status})`);
      const data = await resp.json();
      setCompetitorData(data);
    } catch (e) {
      setError(e.message || 'Failed to run audit');
    } finally {
      setLoading(false);
    }
  };

  const compScores = competitorData?.raw_scorecard?.scores || [];
  const compScore = competitorData
    ? parseFloat((competitorData?.audit_metadata?.percentage || competitorData?.audit_metadata?.score_percentage || calcScore(compScores)).toFixed(1))
    : 0;
  const compDomain = competitorData?.audit_metadata?.domain || competitorData?.audit_metadata?.url || url;

  const scoreDelta = parseFloat((myScore - compScore).toFixed(1));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="bg-gradient-to-r from-rose-600 to-pink-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <ArrowsRightLeftIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">Competitor Audit</h2>
            <p className="text-rose-200 text-sm">Run an AEO audit on any competitor URL and compare side-by-side</p>
          </div>
        </div>

        {/* URL input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-300" />
            <input
              type="url"
              placeholder="https://competitor.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAudit()}
              className="w-full pl-9 pr-4 py-3 bg-white/10 text-white placeholder-rose-300 border border-white/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>
          <button
            onClick={handleAudit}
            disabled={loading || !url.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-white text-rose-700 font-bold text-sm rounded-xl hover:bg-rose-50 disabled:opacity-50 transition-colors"
          >
            {loading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <MagnifyingGlassIcon className="h-4 w-4" />}
            {loading ? 'Auditing…' : 'Audit'}
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-200 bg-red-500/20 px-3 py-2 rounded-lg">
            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-rose-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Running audit on {url}…</p>
          <p className="text-xs text-gray-400 mt-1">This may take 30–60 seconds</p>
        </div>
      )}

      {/* Results */}
      {competitorData && (
        <>
          {/* Score comparison */}
          <div className="grid grid-cols-3 gap-4">
            <div className={`rounded-xl p-5 text-center border-2 ${scoreDelta >= 0 ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
              <div className="text-3xl font-black text-gray-900">{myScore}%</div>
              <div className="text-sm font-semibold text-gray-600 mt-1">{myDomain}</div>
              <div className="text-xs text-gray-400 mt-0.5">Your Score</div>
            </div>

            <div className="rounded-xl p-5 text-center border-2 border-gray-200 bg-white flex flex-col items-center justify-center">
              <div className={`text-2xl font-black ${scoreDelta > 0 ? 'text-green-600' : scoreDelta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta === 0 ? '=' : scoreDelta}%
              </div>
              {scoreDelta > 0
                ? <ArrowTrendingUpIcon className="h-6 w-6 text-green-400 mt-1" />
                : scoreDelta < 0
                ? <ArrowTrendingDownIcon className="h-6 w-6 text-red-400 mt-1" />
                : null}
              <div className="text-xs text-gray-400 mt-1">
                {scoreDelta > 0 ? 'You lead' : scoreDelta < 0 ? 'They lead' : 'Tied'}
              </div>
            </div>

            <div className={`rounded-xl p-5 text-center border-2 ${scoreDelta < 0 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
              <div className="text-3xl font-black text-gray-900">{compScore}%</div>
              <div className="text-sm font-semibold text-gray-600 mt-1 truncate">{compDomain}</div>
              <div className="text-xs text-gray-400 mt-0.5">Competitor</div>
            </div>
          </div>

          {/* Signal breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Signal-by-Signal Comparison</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><CheckCircleIcon className="h-4 w-4 text-green-500" />Pass</span>
                <span className="flex items-center gap-1"><XCircleIcon className="h-4 w-4 text-red-400" />Fail</span>
              </div>
            </div>

            {Object.entries(SIGNAL_GROUPS).map(([groupName, signals]) => (
              <div key={groupName}>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{groupName}</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      <th className="py-2 px-4 text-left font-medium">Signal</th>
                      <th className="py-2 px-4 text-center font-medium">You</th>
                      <th className="py-2 px-4 text-center font-medium">Competitor</th>
                      <th className="py-2 px-4 text-center font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map(sig => (
                      <SignalRow
                        key={sig}
                        signalName={sig}
                        yourStatus={getSignalStatus(myScores, sig)}
                        theirStatus={getSignalStatus(compScores, sig)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Opportunities */}
          {(() => {
            const gaps = Object.values(SIGNAL_GROUPS).flat().filter(sig => {
              const mine = getSignalStatus(myScores, sig);
              const theirs = getSignalStatus(compScores, sig);
              return theirs === true && mine === false;
            });
            if (!gaps.length) return null;
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-bold text-amber-800 mb-2">
                  Gap Opportunities — signals your competitor passes that you fail
                </p>
                <div className="flex flex-wrap gap-2">
                  {gaps.map(sig => (
                    <span key={sig} className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full border border-amber-200">
                      {sig.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {!competitorData && !loading && (
        <div className="text-center py-12 text-gray-400">
          <ArrowsRightLeftIcon className="h-10 w-10 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500">Enter a competitor URL above and click Audit</p>
          <p className="text-xs mt-1">The audit checks all AEO signals and returns a side-by-side comparison</p>
        </div>
      )}
    </div>
  );
}
