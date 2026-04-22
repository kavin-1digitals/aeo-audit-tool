import React, { useState, useMemo } from 'react';
import {
  BeakerIcon, ChatBubbleLeftRightIcon, CheckCircleIcon,
  XCircleIcon, MagnifyingGlassIcon, ChevronDownIcon, ChevronUpIcon,
  CpuChipIcon, SparklesIcon,
} from '@heroicons/react/24/outline';

const ENGINE_META = {
  chatgpt: { label: 'ChatGPT', color: 'green', bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  perplexity: { label: 'Perplexity', color: 'blue', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  gemini: { label: 'Gemini', color: 'purple', bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  claude: { label: 'Claude', color: 'orange', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
};

function extractPrompts(auditData) {
  const llm = auditData?.llm_analysis_combined || auditData?.llm_analysis || {};
  const prompts = [];

  // citation_prompt_answers: { engine: [ { prompt, answer, cited } ] }
  const cpa = llm.citation_prompt_answers || {};
  Object.entries(cpa).forEach(([engine, answers]) => {
    if (!Array.isArray(answers)) return;
    answers.forEach(a => {
      prompts.push({
        id: `${engine}::${a.prompt?.slice(0, 40)}`,
        engine,
        prompt: a.prompt || '(no prompt text)',
        answer: a.answer || a.response || '',
        cited: !!(a.cited || a.brand_mentioned || a.mentioned),
        type: 'citation',
      });
    });
  });

  // cluster_results: { cluster_name: { prompts: [...], engines: [...] } }
  const cr = llm.cluster_results || {};
  Object.entries(cr).forEach(([cluster, data]) => {
    const clusterPrompts = data.prompts || [];
    const engines = data.engines || [];
    clusterPrompts.forEach((p, i) => {
      const engine = engines[i % engines.length] || 'unknown';
      prompts.push({
        id: `cluster::${cluster}::${i}`,
        engine,
        cluster,
        prompt: typeof p === 'string' ? p : p.prompt || '(prompt)',
        answer: typeof p === 'object' ? (p.answer || p.response || '') : '',
        cited: typeof p === 'object' ? !!(p.cited || p.brand_mentioned) : false,
        type: 'cluster',
      });
    });
  });

  return prompts;
}

const PromptCard = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = ENGINE_META[item.engine] || {
    label: item.engine, badge: 'bg-gray-100 text-gray-600', border: 'border-gray-200', bg: 'bg-white',
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${meta.border}`}>
      <div className={`p-4 ${meta.bg}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {item.cited
              ? <CheckCircleIcon className="h-5 w-5 text-green-500" />
              : <XCircleIcon className="h-5 w-5 text-red-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>
                {meta.label}
              </span>
              {item.cluster && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                  {item.cluster}
                </span>
              )}
              <span className={`text-xs font-bold ${item.cited ? 'text-green-700' : 'text-red-600'}`}>
                {item.cited ? '✓ Brand Cited' : '✗ Not Cited'}
              </span>
            </div>

            <p className="text-sm font-semibold text-gray-800 leading-snug mb-1">
              {item.prompt}
            </p>

            {item.answer && (
              <>
                <p className={`text-xs text-gray-600 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                  {item.answer}
                </p>
                {item.answer.length > 120 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-1 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                  >
                    {expanded
                      ? <><ChevronUpIcon className="h-3 w-3" />Show less</>
                      : <><ChevronDownIcon className="h-3 w-3" />Show AI response</>}
                  </button>
                )}
              </>
            )}
            {!item.answer && (
              <p className="text-xs text-gray-400 italic">No response captured</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PromptsLab({ auditData }) {
  const [search, setSearch] = useState('');
  const [engineFilter, setEngineFilter] = useState('All');
  const [citedFilter, setCitedFilter] = useState('All');

  const allPrompts = useMemo(() => extractPrompts(auditData), [auditData]);

  const engines = useMemo(() => {
    const seen = new Set(allPrompts.map(p => p.engine));
    return ['All', ...Array.from(seen)];
  }, [allPrompts]);

  const filtered = useMemo(() => {
    return allPrompts.filter(p => {
      if (engineFilter !== 'All' && p.engine !== engineFilter) return false;
      if (citedFilter === 'Cited' && !p.cited) return false;
      if (citedFilter === 'Not Cited' && p.cited) return false;
      if (search && !p.prompt.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allPrompts, engineFilter, citedFilter, search]);

  const citedCount = allPrompts.filter(p => p.cited).length;
  const citationRate = allPrompts.length > 0 ? Math.round((citedCount / allPrompts.length) * 100) : 0;

  if (allPrompts.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <div className="bg-indigo-100 rounded-full p-6 inline-block mb-4">
          <BeakerIcon className="h-12 w-12 text-indigo-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Prompt Data Available</h3>
        <p className="text-gray-500 max-w-sm mx-auto">
          Prompt data is captured when the LLM analysis runs against AI engines. Run a full audit to populate this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <BeakerIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">AI Prompts Lab</h2>
            <p className="text-violet-200 text-sm">Every prompt tested against AI engines — and whether your brand was cited</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black">{allPrompts.length}</div>
            <div className="text-violet-200 text-xs mt-1">Total Prompts</div>
          </div>
          <div className={`rounded-xl p-4 text-center ${citationRate >= 50 ? 'bg-green-500/30' : 'bg-red-500/20'}`}>
            <div className={`text-3xl font-black ${citationRate >= 50 ? 'text-green-300' : 'text-red-300'}`}>
              {citedCount}
            </div>
            <div className="text-violet-200 text-xs mt-1">Brand Cited</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <div className={`text-3xl font-black ${citationRate >= 50 ? 'text-green-300' : ''}`}>
              {citationRate}%
            </div>
            <div className="text-violet-200 text-xs mt-1">Citation Rate</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search prompts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Engine filter */}
          <div className="flex flex-wrap gap-1.5">
            {engines.map(e => {
              const m = ENGINE_META[e];
              return (
                <button
                  key={e}
                  onClick={() => setEngineFilter(e)}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                    engineFilter === e
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                  }`}
                >
                  {m && <span className={`w-2 h-2 rounded-full ${m.dot}`} />}
                  {m ? m.label : e.charAt(0).toUpperCase() + e.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Cited filter */}
          <div className="flex gap-1.5">
            {['All', 'Cited', 'Not Cited'].map(v => (
              <button
                key={v}
                onClick={() => setCitedFilter(v)}
                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                  citedFilter === v
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prompt list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ChatBubbleLeftRightIcon className="h-10 w-10 mx-auto mb-2" />
          <p className="text-sm">No prompts match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600 px-1">
            {filtered.length} prompt{filtered.length !== 1 ? 's' : ''}
          </p>
          {filtered.map(item => <PromptCard key={item.id} item={item} />)}
        </div>
      )}

      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
        <SparklesIcon className="h-5 w-5 text-violet-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-violet-700 leading-relaxed">
          These prompts were tested against live AI engines during the audit. Citation means the AI mentioned your brand name or domain in its response. Improve your cluster score by creating content that directly answers these queries.
        </p>
      </div>
    </div>
  );
}
