import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  WrenchScrewdriverIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  CpuChipIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

const STORAGE_KEY = 'aeo_fixed_issues';

// ── helpers ──────────────────────────────────────────────────────────────────

const SIGNAL_WEIGHTS = {
  // LLM
  cluster_presence: 12, cluster_dominance: 12, prompt_citation: 16,
  // Domain
  llms_txt_exists: 4, llms_txt_valid: 3, llms_txt_enriched: 3,
  robots_txt_exists: 3,
  sitemap_exists: 3, sitemap_type_valid: 3, sitemap_freshness: 3,
  ai_crawler_access: 4, search_crawler_access: 4,
  // Site
  site_scrapable: 6,
  canonical_exists: 4, canonical_matches: 3, canonical_clean: 3,
  jsonld_exists: 3, jsonld_valid: 3,
  og_tags_exists: 3, og_tags_complete: 2, twitter_card_exists: 1, page_indexable: 2,
};

const CATEGORY_META = {
  'LLM Signals': { icon: CpuChipIcon, color: 'purple', bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  'Domain Signals': { icon: GlobeAltIcon, color: 'blue', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  'Site Signals': { icon: CodeBracketIcon, color: 'green', bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
};

const getSeverity = (weight) => {
  if (weight >= 10) return { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200', dot: 'bg-red-500' };
  if (weight >= 4)  return { label: 'High',     color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200', dot: 'bg-orange-500' };
  if (weight >= 2)  return { label: 'Medium',   color: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-200', dot: 'bg-yellow-500' };
  return               { label: 'Low',      color: 'text-gray-600',   bg: 'bg-gray-100',   border: 'border-gray-200',   dot: 'bg-gray-400' };
};

const formatSignalName = (name) =>
  name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const getCategoryFromPath = (path = []) => {
  const first = path[0] || '';
  if (first.toLowerCase().includes('llm')) return 'LLM Signals';
  if (first.toLowerCase().includes('domain')) return 'Domain Signals';
  return 'Site Signals';
};

// ── issue extraction ──────────────────────────────────────────────────────────

function extractIssues(auditData) {
  const scores = auditData?.raw_scorecard?.scores || [];
  const seen = new Set();
  const issues = [];

  scores
    .filter(s => s.value < 0 && s.remediation_plan)
    .forEach(s => {
      // Deduplicate by signal_name + first remediation sentence
      const key = `${s.signal_name}::${s.remediation_plan.slice(0, 60)}`;
      if (seen.has(key)) return;
      seen.add(key);

      const category = getCategoryFromPath(s.signal_path);
      const weight = SIGNAL_WEIGHTS[s.signal_name] || 1;
      const severity = getSeverity(weight);

      issues.push({
        id: key,
        signal_name: s.signal_name,
        displayName: formatSignalName(s.signal_name),
        category,
        path: s.signal_path,
        remediation: s.remediation_plan,
        weight,
        severity,
      });
    });

  // Sort: severity weight desc, then name
  return issues.sort((a, b) => b.weight - a.weight);
}

// ── sub-components ────────────────────────────────────────────────────────────

const SeverityFilter = ({ active, onChange }) => {
  const options = ['All', 'Critical', 'High', 'Medium', 'Low'];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
            active === o
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
};

const CategoryFilter = ({ active, onChange, counts }) => (
  <div className="flex flex-wrap gap-1.5">
    {['All', 'LLM Signals', 'Domain Signals', 'Site Signals'].map(cat => {
      const meta = CATEGORY_META[cat];
      const count = cat === 'All' ? counts.total : (counts[cat] || 0);
      return (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
            active === cat
              ? 'bg-blue-600 text-white border-blue-600'
              : `bg-white text-gray-600 border-gray-200 hover:border-blue-300`
          }`}
        >
          {meta && <meta.icon className="h-3 w-3" />}
          {cat === 'All' ? 'All Categories' : cat.replace(' Signals', '')}
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${active === cat ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {count}
          </span>
        </button>
      );
    })}
  </div>
);

const IssueCard = ({ issue, isFixed, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[issue.category] || CATEGORY_META['Site Signals'];
  const CategoryIcon = meta.icon;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      isFixed ? 'opacity-50 border-gray-200 bg-gray-50' : `border-gray-200 bg-white hover:shadow-sm`
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Fix checkbox */}
          <button
            onClick={() => onToggle(issue.id)}
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isFixed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
            }`}
          >
            {isFixed && <CheckCircleIcon className="h-3.5 w-3.5 text-white" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <span className={`text-sm font-bold ${isFixed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {issue.displayName}
              </span>
              {/* Severity badge */}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${issue.severity.bg} ${issue.severity.color} ${issue.severity.border}`}>
                {issue.severity.label}
              </span>
              {/* Category badge */}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.badge}`}>
                <CategoryIcon className="h-2.5 w-2.5" />
                {issue.category.replace(' Signals', '')}
              </span>
              {/* Score impact */}
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {issue.weight} pts
              </span>
            </div>

            {/* Remediation preview */}
            <p className={`text-xs leading-relaxed ${isFixed ? 'text-gray-400' : 'text-gray-600'} ${expanded ? '' : 'line-clamp-2'}`}>
              {issue.remediation}
            </p>

            {issue.remediation.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
              >
                {expanded ? <><ChevronUpIcon className="h-3 w-3" /> Show less</> : <><ChevronDownIcon className="h-3 w-3" /> Show more</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── main ──────────────────────────────────────────────────────────────────────

const FixIssues = ({ auditData }) => {
  const [fixedIds, setFixedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
    catch { return new Set(); }
  });
  const [severityFilter, setSeverityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showFixed, setShowFixed] = useState(false);

  const allIssues = useMemo(() => extractIssues(auditData), [auditData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...fixedIds]));
  }, [fixedIds]);

  const toggleFixed = (id) => {
    setFixedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearFixed = () => setFixedIds(new Set());

  // Counts per category
  const counts = useMemo(() => {
    const c = { total: allIssues.length };
    allIssues.forEach(i => { c[i.category] = (c[i.category] || 0) + 1; });
    return c;
  }, [allIssues]);

  // Filtered
  const filtered = useMemo(() => {
    return allIssues.filter(i => {
      if (!showFixed && fixedIds.has(i.id)) return false;
      if (severityFilter !== 'All' && i.severity.label !== severityFilter) return false;
      if (categoryFilter !== 'All' && i.category !== categoryFilter) return false;
      return true;
    });
  }, [allIssues, fixedIds, severityFilter, categoryFilter, showFixed]);

  const fixedCount = allIssues.filter(i => fixedIds.has(i.id)).length;
  const progress = allIssues.length > 0 ? (fixedCount / allIssues.length) * 100 : 0;

  const totalPtsToFix = allIssues.filter(i => !fixedIds.has(i.id)).reduce((s, i) => s + i.weight, 0);
  const currentScore = auditData?.audit_metadata?.percentage || auditData?.audit_metadata?.score_percentage || 0;

  if (allIssues.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <div className="bg-green-100 rounded-full p-6 inline-block mb-4">
          <CheckCircleIcon className="h-12 w-12 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Issues Found</h3>
        <p className="text-gray-500">All signals passed. Your AEO health is excellent.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Progress header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <WrenchScrewdriverIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black">Fix Issues</h2>
              <p className="text-blue-100 text-sm">{allIssues.length} issues found · {fixedCount} marked fixed</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black">{currentScore.toFixed(1)}%</div>
            <div className="text-blue-200 text-xs">current score</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-blue-200 mb-1">
            <span>{fixedCount} of {allIssues.length} issues resolved</span>
            <span>{progress.toFixed(0)}% complete</span>
          </div>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Severity summary pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          {['Critical', 'High', 'Medium', 'Low'].map(sev => {
            const n = allIssues.filter(i => i.severity.label === sev && !fixedIds.has(i.id)).length;
            if (n === 0) return null;
            const colors = { Critical: 'bg-red-500', High: 'bg-orange-400', Medium: 'bg-yellow-400', Low: 'bg-gray-300' };
            return (
              <span key={sev} className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors[sev]} text-white`}>
                {n} {sev}
              </span>
            );
          })}
          {totalPtsToFix > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 text-white flex items-center gap-1">
              <ArrowTrendingUpIcon className="h-3 w-3" />
              {totalPtsToFix} pts remaining
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <FunnelIcon className="h-4 w-4" />
          Filters
        </div>
        <CategoryFilter active={categoryFilter} onChange={setCategoryFilter} counts={counts} />
        <SeverityFilter active={severityFilter} onChange={setSeverityFilter} />
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showFixed}
              onChange={e => setShowFixed(e.target.checked)}
              className="rounded"
            />
            Show fixed issues
          </label>
          {fixedCount > 0 && (
            <button onClick={clearFixed} className="text-xs text-red-500 hover:text-red-700 font-medium">
              Clear all marks
            </button>
          )}
        </div>
      </div>

      {/* Issue list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircleIcon className="h-10 w-10 mx-auto mb-2 text-green-400" />
          <p className="text-sm font-medium text-gray-500">
            {showFixed ? 'No issues match the current filter.' : 'All visible issues are marked as fixed!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-gray-600">{filtered.length} issue{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          {filtered.map(issue => (
            <IssueCard
              key={issue.id}
              issue={issue}
              isFixed={fixedIds.has(issue.id)}
              onToggle={toggleFixed}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-center text-gray-400 pb-4">
        Fix status is saved in your browser. Marking an issue as fixed does not re-run the audit — run a new audit to verify improvements.
      </p>
    </div>
  );
};

export default FixIssues;
