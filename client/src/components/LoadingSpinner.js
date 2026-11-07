import React, { useState, useEffect } from 'react';
import { useAudit } from '../contexts/AuditContext';
import {
  CheckCircleIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  CommandLineIcon,
  SparklesIcon,
  ChartPieIcon,
  QueueListIcon,
  PresentationChartLineIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

// Status, percentage, counters, timings and warnings all come from the backend (GET /runs/{id}/status).
// Only the friendly wording below (and the tips) is static UI copy, keyed by the backend's stage keys.
const STAGE_COPY = {
  domain_signals:  { title: 'Domain Signals',     description: 'robots.txt, llms.txt, sitemap',      message: 'Auditing domain signals (robots.txt, llms.txt, sitemaps)...', icon: GlobeAltIcon },
  site_crawl:      { title: 'Site Crawling',      description: 'fetching pages',                      message: 'Crawling your site and collecting pages...',                   icon: QueueListIcon, unit: 'pages' },
  site_processing: { title: 'Signal Processing',  description: 'canonical, JSON-LD & meta tags',      message: 'Validating canonical tags, JSON-LD & structured data...',      icon: CommandLineIcon, unit: 'pages' },
  ai_prompts:      { title: 'Brand Analysis',     description: 'entity profile & prompt generation',  message: 'Analysing your brand and generating AI prompts...',            icon: SparklesIcon },
  ai_answers:      { title: 'AI Answers',         description: 'web + model answers per prompt',      message: 'Benchmarking brand citations and LLM visibility...',           icon: PresentationChartLineIcon, unit: 'prompts' },
  market_analysis: { title: 'Market Analysis',    description: 'share of voice & coverage',           message: 'Evaluating competitor authority and positioning...',           icon: PresentationChartLineIcon },
  scoring:         { title: 'Score Calculation',  description: 'AEO scoring',                         message: 'Calculating your AEO scorecard...',                            icon: ChartPieIcon },
  summary:         { title: 'Recommendations',    description: 'summary & quick fixes',               message: 'Preparing AI recommendations...',                              icon: ChartPieIcon },
  persist:         { title: 'Saving Report',      description: 'storing results',                     message: 'Saving your report...',                                        icon: ChartPieIcon },
};

const LANE_TITLES = {
  domain: 'Domain',
  site: 'Site',
  ai: 'AI Visibility',
  final: 'Report',
};

const aeoTips = [
  "Adding an 'llms.txt' file at your root directory helps AI agents discover your most important content efficiently.",
  "Prioritize JSON-LD structured data to ensure AI search engines accurately understand your product features.",
  "A clear header hierarchy (H1, H2, H3) helps AI agents parse your content's logical flow and key arguments.",
  "Robots.txt should explicitly allow AI crawlers like GPTBot if you want your content to be used in AI search answers.",
  "High citation consistency across third-party sites improves your brand's authority signal for AI search engines.",
  "Use canonical tags correctly to prevent AI search engines from indexing duplicate versions of your content."
];

const formatTime = (seconds) => {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const StageIcon = ({ status }) => {
  if (status === 'done') return <CheckCircleIcon className="h-5 w-5 text-emerald-500" />;
  if (status === 'running') return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
  if (status === 'failed') return <XCircleIcon className="h-5 w-5 text-amber-500" />;
  if (status === 'skipped') return <MinusCircleIcon className="h-5 w-5 text-slate-300" />;
  return <div className="h-5 w-5 rounded-full border-2 border-slate-200"></div>;
};

export const LoadingSpinner = () => {
  const { isLoading, runStatus, cancelAudit } = useAudit();
  const [currentTip, setCurrentTip] = useState(0);
  const [fadeTip, setFadeTip] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isLoading) {
      setCurrentTip(0);
      return undefined;
    }
    const tipInterval = setInterval(() => {
      setFadeTip(false);
      setTimeout(() => {
        setCurrentTip(prev => (prev + 1) % aeoTips.length);
        setFadeTip(true);
      }, 500);
    }, 8000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(tipInterval);
      clearInterval(clock);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  const status = runStatus;
  const lanes = status?.lanes || [];
  const queued = !status || status.status === 'pending';
  const pct = Math.round(status?.progress_pct || 0);

  // Elapsed = server-reported elapsed + time since that report arrived (keeps ticking between polls).
  const elapsed = status && status.status === 'running'
    ? status.elapsed_s + (now - status.receivedAt) / 1000
    : status?.elapsed_s || 0;

  const runningKeys = lanes.flatMap(l => l.stages).filter(s => s.status === 'running').map(s => s.key);
  const currentKey = runningKeys[0] || status?.stage_key;
  const current = STAGE_COPY[currentKey];
  const CurrentIcon = current?.icon || SparklesIcon;
  const headline = queued
    ? (status ? 'Waiting for a free slot...' : 'Starting your audit...')
    : current?.message || 'Working on your audit...';

  const counter = (stage) => {
    if (!stage.progress_total) return null;
    const unit = STAGE_COPY[stage.key]?.unit;
    return `${stage.progress_current || 0}/${stage.progress_total}${unit ? ` ${unit}` : ''}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col md:flex-row h-full">
          {/* Left Panel: Main Status */}
          <div className="flex-1 p-8 bg-gradient-to-b from-white to-slate-50 border-r border-slate-100">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Circular Progress (real backend progress) */}
              <div className="relative h-32 w-32">
                <svg className="h-full w-full transform -rotate-90">
                  <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                  <circle
                    cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent"
                    strokeDasharray={377}
                    strokeDashoffset={377 - (377 * pct) / 100}
                    className="text-blue-600 transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{pct}%</span>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Analyzing AI Readiness</h2>
                <div className="flex items-center justify-center space-x-2 text-slate-500 font-medium min-h-[1.5rem]">
                  <CurrentIcon className="h-5 w-5 text-blue-500 animate-pulse flex-shrink-0" />
                  <span className="transition-all duration-500">{headline}</span>
                </div>
              </div>

              <div className="w-full bg-slate-100 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Time Elapsed</span>
                  <span className="text-lg font-mono font-bold text-slate-700">{formatTime(elapsed)}</span>
                </div>
                <div className="h-10 w-[1px] bg-slate-200"></div>
                <div className="flex flex-col items-end">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Typical Run</span>
                  <span className="text-lg font-mono font-bold text-slate-700">
                    {status?.typical_duration_s ? `~${formatTime(status.typical_duration_s)}` : 'a few min'}
                  </span>
                </div>
              </div>

              {status?.warnings?.length > 0 && (
                <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-3 text-left flex items-start space-x-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <p className="text-amber-800 text-xs leading-relaxed">{status.warnings[status.warnings.length - 1]}</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 w-full text-left min-h-[100px] flex items-center">
                <div className="flex items-start space-x-3 w-full">
                  <SparklesIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
                  <div className={`transition-opacity duration-500 ${fadeTip ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="text-blue-900 font-bold text-sm">AEO Tip</p>
                    <p className="text-blue-700 text-xs leading-relaxed">{aeoTips[currentTip]}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={cancelAudit}
                className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors"
              >
                Cancel audit
              </button>
            </div>
          </div>

          {/* Right Panel: real analysis steps, grouped in lanes that run in parallel */}
          <div className="w-full md:w-80 bg-slate-50 p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Analysis Progress</h3>
            {lanes.length === 0 && (
              <p className="text-xs text-slate-400">Preparing the audit...</p>
            )}
            <div className="space-y-5">
              {lanes.map(lane => (
                <div key={lane.lane}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{LANE_TITLES[lane.lane] || lane.lane}</p>
                  <div className="space-y-2">
                    {lane.stages.map(stage => {
                      const copy = STAGE_COPY[stage.key] || { title: stage.key, description: '' };
                      return (
                        <div key={stage.key} className={`flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-slate-200/50 ${stage.status === 'skipped' ? 'opacity-60' : ''}`}>
                          <div className="flex flex-col pr-2">
                            <span className="text-sm font-bold text-slate-700">{copy.title}</span>
                            <span className="text-[10px] text-slate-500">
                              {stage.status === 'running' && counter(stage) ? counter(stage) : copy.description}
                            </span>
                          </div>
                          <StageIcon status={stage.status} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <p className="text-[10px] text-slate-400 font-bold">POWERED BY 1DIGITALS AI CORE</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
