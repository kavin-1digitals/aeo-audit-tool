import React, { useState, useRef } from 'react';
import {
  DocumentArrowDownIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  SparklesIcon,
  ChartBarIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const PrintableGatedMask = ({ children, isUngated, label = "Strategic Insights Locked" }) => {
  if (isUngated) return children;
  return (
    <div className="relative">
      {/* Heavy blur and ultra-low opacity to ensure non-readability */}
      <div className="opacity-[0.03] blur-[15px] select-none pointer-events-none grayscale transition-all">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="bg-white/95 border-2 border-dashed border-gray-200 px-12 py-8 rounded-[2rem] shadow-2xl flex flex-col items-center text-center max-w-sm">
          <div className="bg-blue-50 p-4 rounded-full mb-4 shadow-inner">
            <LockClosedIcon className="h-8 w-8 text-blue-500" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-blue-600 mb-2">{label}</span>
          <h4 className="text-sm font-black text-gray-900 mb-3 uppercase tracking-tight">Premium Analysis Required</h4>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-relaxed">
            Upgrade to premium to unlock full strategic insights, technical root causes, and complete remediation blueprints.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * THIN LAYER PRINT COMPONENTS
 * Standalone versions of dashboard components optimized for linear, structured PDF generation.
 * These use API-derived data directly to ensure accuracy and alignment.
 */

const formatSignalName = (signalName) => {
  const nameMap = {
    'llm_txt_exists': 'LLM.txt File',
    'robots_txt_exists': 'Robots.txt File',
    'sitemap_exists': 'Sitemap File',
    'sitemap_type_valid': 'Sitemap Type',
    'category_url_count': 'Category URLs',
    'product_url_count': 'Product URLs',
    'brand_citation': 'Brand Citations',
    'cluster_coverage': 'Cluster Coverage',
    'competitive_gap': 'Competitive Gaps',
    'jsonld_exists': 'JSON-LD Schema',
    'jsonld_valid': 'Schema Validation',
    'canonical_exists': 'Canonical URL',
    'site_scrapable': 'Site Accessibility'
  };
  return nameMap[signalName] || signalName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const PrintableScorecards = ({ auditData, llmMetrics, audit_metadata }) => {
  const pathScorecard = auditData?.path_scorecard || {};

  const getTechnicalReadiness = () => {
    const domainSignals = Object.values(pathScorecard).filter(item => item.signal_path && item.signal_path[0] === 'Domain Signals');
    const siteSignals = Object.values(pathScorecard).filter(item => item.signal_path && item.signal_path[0] === 'Site Signals');
    const allTechnicalScores = [...(domainSignals.flatMap(item => item.scores || [])), ...(siteSignals.flatMap(item => item.scores || []))];
    if (allTechnicalScores.length === 0) return 0;
    return (allTechnicalScores.filter(score => score.value > 0).length / allTechnicalScores.length) * 100;
  };

  const getAIPromptVisibility = () => {
    const clusters = llmMetrics?.citation_prompt_answers || [];
    let totalPrompts = 0, brandCitations = 0;
    clusters.forEach(cluster => {
      totalPrompts += cluster.prompts?.length || 0;
      cluster.prompts?.forEach(prompt => { if (prompt.is_brand_mentioned) brandCitations++; });
    });
    return { score: totalPrompts === 0 ? 0 : (brandCitations / totalPrompts) * 100, totalPrompts, brandCitations, clusterCount: clusters.length };
  };

  const getCompetitorCitationScore = () => {
    const clusters = llmMetrics?.citation_prompt_answers || [];
    let totalPrompts = 0;
    const competitorCitations = {};
    clusters.forEach(cluster => {
      totalPrompts += cluster.prompts?.length || 0;
      cluster.prompts?.forEach(prompt => {
        prompt.competitor_citations?.forEach(citation => {
          if (citation.is_competitor_mentioned) {
            const comp = citation.competitor_brand;
            competitorCitations[comp] = (competitorCitations[comp] || 0) + 1;
          }
        });
      });
    });
    const bestCompCitations = Math.max(0, ...Object.values(competitorCitations));
    return totalPrompts === 0 ? 0 : (bestCompCitations / totalPrompts) * 100;
  };

  const getClustersCovered = () => {
    const marketData = llmMetrics?.market_comparison || [];
    const mainBrandData = marketData.find(item => item.brand === audit_metadata.brand) || { cluster_coverage: 0 };
    return mainBrandData.cluster_coverage || 0;
  };

  const visibility = getAIPromptVisibility();
  const techScore = getTechnicalReadiness();
  const compScore = getCompetitorCitationScore();
  const clusterScore = getClustersCovered();

  const primaryMetrics = [
    { label: 'Technical Readiness', value: `${techScore.toFixed(0)}%`, num: techScore, color: '#3b82f6', desc: `Domain optimization + Site signals accessibility score` },
    { label: 'AI Prompt Visibility', value: `${visibility.score.toFixed(1)}%`, num: visibility.score, color: '#8b5cf6', desc: `Brand mentioned in ${visibility.brandCitations} of ${visibility.totalPrompts} AI prompts` },
    { label: 'Competitor Citation Score', value: `${compScore.toFixed(1)}%`, num: compScore, color: '#ef4444', desc: `Performance relative to top competing mentions in AI responses` },
    { label: 'Clusters Covered', value: `${clusterScore.toFixed(1)}%`, num: clusterScore, color: '#06b6d4', desc: `Brand presence across defined user intent clusters` }
  ];

  const MetricBar = ({ label, value, num, color, desc }) => (
    <div className="bg-white border border-gray-100 rounded-[1.5rem] p-6 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</div>
        <div className="text-xl font-black" style={{ color }}>{value}</div>
      </div>
      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mb-4 shadow-inner">
        <div className="h-full rounded-full transition-all" style={{ width: `${num}%`, backgroundColor: color }} />
      </div>
      <p className="text-[9px] leading-relaxed text-gray-500 font-bold">{desc}</p>
    </div>
  );

  const secondaryMetrics = [
    { label: 'Pages Analyzed', value: auditData?.signals?.site_signals?.site_signals?.length || 0, desc: 'Website pages crawled for analysis' },
    { label: 'Prompts Used', value: visibility.totalPrompts, desc: 'AI conversation prompts tested' },
    { label: 'Competitors Identified', value: (llmMetrics?.market_comparison || []).length - 1, desc: 'Competing brands benchmarked' }
  ];

  return (
    <div className="space-y-6 mb-8 mt-4">
      <div className="grid grid-cols-2 gap-6">
        {primaryMetrics.map((m, i) => (
          <MetricBar key={i} {...m} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        {secondaryMetrics.map((m, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col h-full">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{m.label}</div>
            <div className="text-3xl font-black text-gray-900 mb-2">{m.value}</div>
            <p className="text-[9px] leading-relaxed text-gray-500 font-bold">{m.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const REMEDIATION_PALETTES = [
  { accent: '#10b981', bg: '#f0fdf4', border: '#dcfce7', light: '#ecfdf5' }, // Emerald
  { accent: '#f59e0b', bg: '#fffbeb', border: '#fef3c7', light: '#fffef2' }, // Amber
  { accent: '#8b5cf6', bg: '#f5f3ff', border: '#ede9fe', light: '#f9f8ff' }, // Violet
  { accent: '#06b6d4', bg: '#ecfeff', border: '#cffafe', light: '#f0fdff' }, // Cyan
];

const PrintableRemediations = ({ quickRemediations, currentScore, isUngated = true }) => {
  if (!quickRemediations || !quickRemediations.plans) return null;

  return (
    <div className="space-y-10 mb-10 mt-4">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-black text-gray-900 mb-2">Remediation Plans</h3>
        <p className="text-sm font-bold text-gray-400">Strategic improvements to boost your score from {currentScore.toFixed(1)}% to near-perfect</p>
      </div>

      {isUngated ? (
        quickRemediations.plans.map((plan, i) => (
          <RemediationPlanCard
            key={i}
            plan={plan}
            palette={REMEDIATION_PALETTES[i % REMEDIATION_PALETTES.length]}
          />
        ))
      ) : (
        <>
          {quickRemediations.plans.slice(0, 1).map((plan, i) => (
            <RemediationPlanCard
              key={i}
              plan={plan}
              palette={REMEDIATION_PALETTES[0]}
            />
          ))}
          {quickRemediations.plans.length > 1 && (
            <PrintableGatedMask isUngated={false} label="Advanced Strategies Gated">
              <div className="space-y-6">
                {quickRemediations.plans.slice(1).map((plan, i) => {
                  const palette = REMEDIATION_PALETTES[(i + 1) % REMEDIATION_PALETTES.length];
                  return (
                    <div key={i} className="border-2 rounded-[1.5rem] p-6 opacity-40" style={{ borderColor: palette.border, backgroundColor: palette.bg }}>
                      <h4 className="text-sm font-black uppercase mb-2" style={{ color: palette.accent }}>{plan.title}</h4>
                      <div className="h-2 rounded-full w-3/4 mb-4" style={{ backgroundColor: palette.border }} />
                      <div className="h-10 rounded-xl w-full" style={{ backgroundColor: palette.light }} />
                    </div>
                  );
                })}
              </div>
            </PrintableGatedMask>
          )}
        </>
      )}
    </div>
  );
};

// Helper component to avoid repetition
const RemediationPlanCard = ({ plan, palette }) => {
  const isQuick = plan.category === 'Quick Fix';
  const Icon = isQuick ? CheckCircleIcon : CalendarIcon;
  return (
    <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm flex flex-col mb-6" style={{ borderColor: palette.border }}>
      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center">
            <div className="p-3 rounded-xl mr-4" style={{ backgroundColor: palette.bg }}>
              <Icon className="h-6 w-6" style={{ color: palette.accent }} />
            </div>
            <div>
              <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-1 inline-block" style={{ backgroundColor: palette.bg, color: palette.accent }}>{plan.category}</span>
              <h4 className="text-xl font-black text-gray-900">{plan.title}</h4>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{plan.difficulty} • {plan.impact_level} Impact</div>
            <div className="text-3xl font-black" style={{ color: palette.accent }}>+{plan.improvement_percentage.toFixed(1)}%</div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase mb-2 px-1">
            <span>Progress</span>
            <span>{plan.current_score.toFixed(1)}% → {plan.target_score.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden flex shadow-inner">
            <div className="bg-blue-500 h-full" style={{ width: `${plan.current_score}%` }}></div>
            <div className="h-full" style={{ width: `${plan.improvement_percentage}%`, backgroundColor: palette.accent }}></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-6 rounded-2xl text-center shadow-sm" style={{ backgroundColor: palette.bg }}>
            <div className="text-3xl font-black text-gray-900">{plan.current_score.toFixed(1)}%</div>
            <div className="text-[9px] font-bold text-gray-400 uppercase mt-1">Current Score</div>
          </div>
          <div className="p-6 rounded-2xl text-center shadow-sm" style={{ backgroundColor: palette.bg }}>
            <div className="text-3xl font-black" style={{ color: palette.accent }}>+{plan.improvement_percentage.toFixed(1)}%</div>
            <div className="text-[9px] font-bold text-gray-400 uppercase mt-1">Potential Gain</div>
          </div>
        </div>

        <p className="text-xs font-bold text-gray-500 mb-8 leading-relaxed">{plan.description}</p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl border border-transparent" style={{ backgroundColor: palette.bg }}>
            <div className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-tighter">Difficulty</div>
            <div className="text-[11px] font-black" style={{ color: palette.accent }}>{plan.difficulty}</div>
          </div>
          <div className="p-4 rounded-xl border border-transparent" style={{ backgroundColor: palette.bg }}>
            <div className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-tighter">Impact Level</div>
            <div className="text-[11px] font-black" style={{ color: palette.accent }}>{plan.impact_level}</div>
          </div>
          <div className="p-4 rounded-xl border border-transparent" style={{ backgroundColor: palette.bg }}>
            <div className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-tighter">Signals to Fix</div>
            <div className="text-[11px] font-black" style={{ color: palette.accent }}>{plan.signals_count}</div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-wider">Signals to Address</h5>
            <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm" style={{ backgroundColor: palette.bg, color: palette.accent }}>{plan.signals_count} targeted</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(plan.signal_names || []).map((name, ni) => (
              <div key={ni} className="flex items-center p-3 rounded-xl border shadow-sm" style={{ borderColor: palette.border, backgroundColor: 'white' }}>
                <div className="w-1.5 h-1.5 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: palette.accent }}></div>
                <span className="text-[10px] font-bold text-gray-700 tracking-tight">{formatSignalName(name)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


const PrintableAuditSummary = ({ summary, isUngated = true }) => {
  if (!summary || (!summary.performance_highlights?.length && !summary.improvement_areas?.length)) {
    return null;
  }

  return (
    <div className="space-y-8 mb-8 mt-4">
      {(summary.performance_highlights?.length > 0) && (
        <div className="bg-green-50/50 border border-green-100 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center mb-6">
            <CheckCircleIcon className="h-6 w-6 text-green-500 mr-3" />
            <h3 className="text-xl font-bold text-gray-900">Performance Highlights</h3>
          </div>
          <div className="space-y-4">
            {isUngated ? (
              summary.performance_highlights.map((h, i) => (
                <div key={i} className="flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-4 mt-2 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-gray-700 leading-relaxed">{h}</p>
                </div>
              ))
            ) : (
              <>
                {summary.performance_highlights.slice(0, 1).map((h, i) => (
                  <div key={i} className="flex items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-4 mt-2 flex-shrink-0" />
                    <p className="text-[11px] font-bold text-gray-700 leading-relaxed">{h}</p>
                  </div>
                ))}

                {summary.performance_highlights.length > 1 && (
                  <PrintableGatedMask isUngated={false} label="Highlights Gated">
                    <div className="space-y-4">
                      {summary.performance_highlights.slice(1).map((h, i) => (
                        <div key={i} className="flex items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-4 mt-2 flex-shrink-0" />
                          <p className="text-[11px] font-bold text-gray-700 leading-relaxed">{h}</p>
                        </div>
                      ))}
                    </div>
                  </PrintableGatedMask>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {(summary.improvement_areas?.length > 0) && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center mb-6">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-500 mr-3" />
            <h3 className="text-xl font-bold text-gray-900">Areas for Improvement</h3>
          </div>
          <div className="space-y-4">
            {isUngated ? (
              summary.improvement_areas.map((a, i) => (
                <div key={i} className="flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-4 mt-1.5 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-gray-700 leading-relaxed">{a}</p>
                </div>
              ))
            ) : (
              <>
                {summary.improvement_areas.slice(0, 1).map((a, i) => (
                  <div key={i} className="flex items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-4 mt-1.5 flex-shrink-0" />
                    <p className="text-[11px] font-bold text-gray-700 leading-relaxed">{a}</p>
                  </div>
                ))}

                {summary.improvement_areas.length > 1 && (
                  <PrintableGatedMask isUngated={false} label="Improvements Gated">
                    <div className="space-y-4">
                      {summary.improvement_areas.slice(1).map((a, i) => (
                        <div key={i} className="flex items-start">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-4 mt-1.5 flex-shrink-0" />
                          <p className="text-[11px] font-bold text-gray-700 leading-relaxed">{a}</p>
                        </div>
                      ))}
                    </div>
                  </PrintableGatedMask>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PrintableScoreOverview = ({ audit_metadata }) => {
  const percentage = audit_metadata.score_percentage || 0;
  const totalChecks = audit_metadata.total_checks || 0;
  const passedChecks = Math.round((percentage / 100) * totalChecks);
  const failedChecks = totalChecks - passedChecks;

  const getGrade = (p) => {
    if (p >= 90) return { letter: 'A', color: '#10b981', level: 'Excellent', desc: 'Excellent AEO readiness' };
    if (p >= 80) return { letter: 'B', color: '#3b82f6', level: 'Good', desc: 'Good AEO implementation' };
    if (p >= 70) return { letter: 'C', color: '#f59e0b', level: 'Fair', desc: 'Fair AEO optimization needed' };
    if (p >= 60) return { letter: 'D', color: '#f97316', level: 'Poor', desc: 'Poor AEO performance' };
    return { letter: 'F', color: '#ef4444', level: 'Critical', desc: 'Critical AEO issues' };
  };

  const grade = getGrade(percentage);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8 shadow-sm">
      <h3 className="text-xl font-bold text-gray-900 mb-8">Overall Audit Score</h3>
      <div className="flex items-center justify-between">
        {/* Left: Gauge */}
        <div className="relative w-48 h-48 flex items-center justify-center flex-shrink-0">
          <svg className="w-44 h-44 transform -rotate-90">
            <circle cx="88" cy="88" r="75" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
            <circle cx="88" cy="88" r="75" stroke={grade.color} strokeWidth="12" fill="transparent" strokeDasharray="471" strokeDashoffset={471 - (percentage / 100) * 471} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-6xl font-black leading-none mb-1" style={{ color: grade.color }}>{grade.letter}</div>
            <div className="text-xl font-black text-gray-400">{Math.round(percentage)}%</div>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex-1 ml-16 space-y-5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Passed Checks</span>
            <span className="text-2xl font-black text-green-500">{passedChecks}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Failed Checks</span>
            <span className="text-2xl font-black text-red-500">{failedChecks}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Checks Performed</span>
            <span className="text-2xl font-black text-gray-900">{totalChecks}</span>
          </div>
          <div className="pt-5 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Performance Level</span>
              <span className="px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest" style={{ backgroundColor: `${grade.color}15`, color: grade.color }}>
                {grade.level}
              </span>
            </div>
            <p className="text-right mt-2 text-[10px] font-bold text-gray-400 tracking-tight">{grade.desc}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const PrintableExecutiveSummary = ({ audit_metadata, categories_count, critical_issues, llmMetrics }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const getHealthStatus = (score) => {
    if (score >= 90) return { status: 'Excellent', color: 'text-green-600 bg-green-100' };
    if (score >= 75) return { status: 'Good', color: 'text-blue-600 bg-blue-100' };
    if (score >= 60) return { status: 'Fair', color: 'text-yellow-600 bg-yellow-100' };
    return { status: 'Poor', color: 'text-red-600 bg-red-100' };
  };

  const healthStatus = getHealthStatus(audit_metadata.score_percentage || 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8 shadow-sm">
      <div className="p-6">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold text-gray-900">Executive Summary</h3>
          <div className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${healthStatus.color}`}>
            {healthStatus.status}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8">
          {/* Business Information */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Business Details</h4>
            <div className="space-y-4">
              <div className="flex items-start">
                <GlobeAltIcon className="h-5 w-5 text-gray-300 mr-3 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Domain</p>
                  <p className="text-xs font-bold text-gray-800 break-all">{audit_metadata.domain}</p>
                </div>
              </div>
              <div className="flex items-start">
                <BuildingOfficeIcon className="h-5 w-5 text-gray-300 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Brand</p>
                  <p className="text-xs font-bold text-gray-800">{audit_metadata.brand}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Details */}
          <div className="space-y-6 border-x border-gray-100 px-8">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Audit Details</h4>
            <div className="space-y-4">
              <div className="flex items-start">
                <CalendarIcon className="h-5 w-5 text-gray-300 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Audit Date</p>
                  <p className="text-xs font-bold text-gray-800">{currentDate}</p>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-gray-300 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Categories Tested</p>
                  <p className="text-xs font-bold text-gray-800">{categories_count} analyzed</p>
                </div>
              </div>
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-gray-300 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Critical Issues</p>
                  <p className="text-xs font-bold text-gray-800">{critical_issues} need attention</p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Overview */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Performance Overview</h4>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Brand SOV</p>
                <p className="text-3xl font-black text-gray-900 leading-none">{(llmMetrics?.brandSOV || 0).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Brand Citations</p>
                <p className="text-xs font-bold text-gray-800">{llmMetrics?.brandCitations || 0} citations found</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Cluster Coverage</p>
                <p className="text-xs font-bold text-gray-800">{(llmMetrics?.clusterCoverage || 0).toFixed(1)}% coverage</p>
              </div>
            </div>
          </div>
        </div>

        {/* Geographic & Market Analytics Footer Row */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Geographic Focus</p>
            <p className="text-sm font-bold text-gray-900">{audit_metadata.location}</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Market Analysis</p>
            <p className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block uppercase">LLM Brand Analysis included</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const PrintableLLMAnalysis = ({ llmSignals, brand, isUngated = true }) => {
  if (!llmSignals?.citation_prompt_answers) return null;

  return (
    <PrintableGatedMask isUngated={isUngated} label="LLM Analysis Map Gated">
      <div className="space-y-8">
        {llmSignals.citation_prompt_answers.map((cluster, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
              <h4 className="font-bold text-lg">{cluster.cluster}</h4>
              <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest">
                Market Presence: {(cluster.prompts.filter(p => p.is_brand_mentioned).length / Math.max(1, cluster.prompts.length) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="p-4 space-y-8">
              {cluster.prompts.map((prompt, pIdx) => (
                <div key={pIdx} className="space-y-3 pb-8 border-b border-dashed border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded bg-gray-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-400">{pIdx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 leading-tight mb-2 tracking-tight">{prompt.prompt}</p>
                      <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-600 leading-relaxed italic border-l-4 border-blue-200 max-w-full overflow-hidden">
                        "{prompt.answer}"
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-tighter ${prompt.is_brand_mentioned ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {brand}: {prompt.is_brand_mentioned ? 'Cited' : 'Omitted'}
                        </span>
                        {prompt.competitor_citations.map((c, cIdx) => (
                          <span key={cIdx} className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-tighter ${c.is_competitor_mentioned ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'}`}>
                            {c.competitor_brand}: {c.is_competitor_mentioned ? 'Cited' : 'Skip'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PrintableGatedMask>
  );
};

const PrintableDomainPanels = ({ categories, isUngated = true }) => {
  return (
    <div className="space-y-6">
      {isUngated ? (
        Object.entries(categories).map(([name, data]) => (
          <TechCategoryPanel key={name} name={name} data={data} />
        ))
      ) : (
        <>
          {Object.entries(categories).slice(0, 1).map(([name, data]) => (
            <TechCategoryPanel key={name} name={name} data={data} />
          ))}

          {Object.entries(categories).length > 1 && (
            <PrintableGatedMask isUngated={false} label="Tech Categories Gated">
              <div className="space-y-4 opacity-30">
                {Object.entries(categories).slice(1).map(([name]) => (
                  <div key={name} className="border border-gray-100 rounded p-4 bg-gray-50 flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase">{name} Diagnostic Analysis</span>
                    <div className="w-12 h-4 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </PrintableGatedMask>
          )}
        </>
      )}
    </div>
  );
};

const TechCategoryPanel = ({ name, data }) => {
  const grouped = {};
  (data.scores || []).forEach(s => {
    if (!grouped[s.signal_name]) grouped[s.signal_name] = { name: s.signal_name, items: [] };
    grouped[s.signal_name].items.push(s);
  });

  return (
    <div key={name} className="border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm mb-6">
      <div className="bg-gray-800 p-3 font-bold text-white text-sm uppercase tracking-widest">{name}</div>
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 uppercase text-[9px] font-black">
            <th className="text-left p-4">Dimension & Signal Details</th>
            <th className="text-center p-4 w-24">Performance</th>
            <th className="text-center p-4 w-24">Compliance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Object.values(grouped).map((group, gIdx) => {
            const passed = group.items.filter(i => i.value > 0).length;
            const total = group.items.length;
            const score = (passed / Math.max(1, total)) * 100;
            return (
              <tr key={gIdx} className="hover:bg-gray-50">
                <td className="p-4">
                  <div className="font-black text-gray-900 mb-2 text-[11px] uppercase tracking-tight">{formatSignalName(group.name)}</div>
                  <div className="space-y-1.5 pl-2 border-l-2 border-gray-100">
                    {group.items.map((item, iIdx) => (
                      <div key={iIdx} className="flex items-start space-x-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${item.value > 0 ? 'bg-green-400' : 'bg-red-400'}`}></div>
                        <div className={`text-[10px] leading-tight ${item.value > 0 ? 'text-gray-600' : 'text-red-500 italic'}`}>
                          {item.success_state || item.remediation_plan}
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-4 text-center align-top">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full ${score >= 90 ? 'bg-green-100 text-green-700' : score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {score.toFixed(0)}%
                  </span>
                </td>
                <td className="p-4 text-center align-top font-bold text-gray-300">{passed}/{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};


const PrintableMarketComparison = ({ market_comparison, brand }) => {
  if (!market_comparison || market_comparison.length === 0) return null;

  const mainBrandIndex = market_comparison.findIndex(m => m.brand === brand);
  const mainBrandData = market_comparison[mainBrandIndex] || market_comparison[0];
  const sortedByCitations = [...market_comparison].sort((a, b) => b.brand_citations - a.brand_citations).slice(0, 5);
  const avgCitations = Math.round(market_comparison.reduce((acc, curr) => acc + curr.brand_citations, 0) / market_comparison.length);

  // SVG Bar Chart Component for SOV
  const MarketSOVChart = () => {
    const maxSOV = Math.max(...market_comparison.map(m => m.brand_sov), 1);
    const chartHeight = 120;
    const barWidth = 40;

    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col h-full">
        <h4 className="text-sm font-black text-gray-900 mb-1">Market Comparison</h4>
        <p className="text-[10px] text-gray-400 font-bold uppercase mb-8">Brand vs competitors SOV comparison</p>
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-end justify-between px-4 pb-2 border-b border-gray-100">
            {market_comparison.slice(0, 5).map((item, i) => {
              const barHeight = (item.brand_sov / maxSOV) * chartHeight;
              const isMain = item.brand === brand;
              return (
                <div key={i} className="flex flex-col items-center">
                  <div className="text-[10px] font-black text-gray-900 mb-1">{item.brand_sov}%</div>
                  <div
                    className="rounded-t-lg transition-all"
                    style={{
                      width: `${barWidth}px`,
                      height: `${barHeight}px`,
                      backgroundColor: isMain ? '#8b5cf6' : '#94a3b8'
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* Labels Row */}
          <div className="flex justify-between px-4 mt-3 pb-2 min-h-[40px]">
            {market_comparison.slice(0, 5).map((item, i) => (
              <div key={i} className="flex-1 text-[8px] font-black text-gray-400 text-center leading-[1.2] break-words px-1">
                {item.brand}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const CoverageGauge = () => {
    const coverage = mainBrandData.cluster_coverage || 0;
    const radius = 50;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (coverage / 100) * circ;

    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center h-full">
        <h4 className="text-sm font-black text-gray-900 mb-1 w-full text-left">Prompt's Cluster Coverage</h4>
        <p className="text-[10px] text-gray-400 font-bold uppercase mb-6 w-full text-left">Brand's content cluster coverage distribution</p>
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle cx="64" cy="64" r={radius} stroke="#f1f5f9" strokeWidth="10" fill="transparent" />
            <circle cx="64" cy="64" r={radius} stroke="#8b5cf6" strokeWidth="10" fill="transparent" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xl font-black text-gray-900">{coverage.toFixed(1)}%</div>
            <div className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Coverage</div>
          </div>
        </div>
      </div>
    );
  };

  const CitationComparison = () => {
    const maxCits = Math.max(...sortedByCitations.map(m => m.brand_citations), 1);

    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col h-full">
        <h4 className="text-sm font-black text-gray-900 mb-1">Brand Citations</h4>
        <p className="text-[10px] text-gray-400 font-bold uppercase mb-6">Brand citation count comparison</p>
        <div className="space-y-4 flex-1 flex flex-col justify-center">
          {sortedByCitations.slice(0, 3).map((item, i) => {
            const isMain = item.brand === brand;
            return (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-16 text-[9px] font-black text-gray-700 truncate">{item.brand}</div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(item.brand_citations / maxCits) * 100}%`, backgroundColor: isMain ? '#8b5cf6' : '#f59e0b' }}></div>
                </div>
                <div className="text-[9px] font-black text-gray-900 w-4 text-right">{item.brand_citations}</div>
              </div>
            );
          })}
          <div className="flex items-center space-x-3">
            <div className="w-16 text-[9px] font-black text-gray-400 italic">Average</div>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-400 rounded-full" style={{ width: `${(avgCitations / maxCits) * 100}%` }}></div>
            </div>
            <div className="text-[9px] font-black text-gray-400 w-4 text-right">{avgCitations}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Overview Table Section */}
      <div className="bg-white border border-gray-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="bg-[#2d326e] p-5 font-bold text-white uppercase tracking-[0.2em] text-[10px] flex items-center">
          <GlobeAltIcon className="h-4 w-4 mr-3" />
          Market Intelligence & Share of Voice (SOV)
        </div>
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 uppercase text-[8px] font-black">
              <th className="text-left py-4 px-8 tracking-widest uppercase">Brand Analysis</th>
              <th className="text-center py-4 px-8 tracking-widest uppercase">Citations</th>
              <th className="text-center py-4 px-8 tracking-widest uppercase">Market SOV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {market_comparison.map((item, idx) => {
              const isMain = item.brand === brand;
              return (
                <tr key={idx} className={isMain ? 'bg-blue-50/10' : ''}>
                  <td className="py-5 px-8">
                    <div className="flex items-center">
                      {isMain && <span className="mr-3 text-blue-500 font-bold">★</span>}
                      <div className={`text-xs font-black ${isMain ? 'text-gray-900' : 'text-gray-600'}`}>{item.brand}</div>
                    </div>
                  </td>
                  <td className="py-5 px-8 text-center text-xs font-bold text-gray-500">{item.brand_citations}</td>
                  <td className="py-5 px-8">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isMain ? '#3b82f6' : '#94a3b8' }}></div>
                        <span className={`text-[11px] font-black ${isMain ? 'text-blue-600' : 'text-gray-900'}`}>{item.brand_sov}%</span>
                      </div>
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.brand_sov}%`, backgroundColor: isMain ? '#3b82f6' : '#94a3b8' }}></div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 pb-8">
          <MarketSOVChart />
        </div>
        <div className="col-span-2 space-y-6">
          <div className="h-[180px]">
            <CoverageGauge />
          </div>
          <div className="h-[140px]">
            <CitationComparison />
          </div>
        </div>
      </div>
    </div>
  );
};

const PDFReportGenerator = ({ auditData, onGeneratePDF }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isUngated, setIsUngated] = useState(true);
  const printableRef = useRef(null);

  const generatePDF = async () => {
    setIsGenerating(true);
    setProgress(0);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;

      const llmMetrics = (() => {
        const metadata = auditData.audit_metadata;
        const llmSignals = auditData.signals?.llm_signals;
        if (!llmSignals?.market_comparison) return null;
        const mainBrandData = llmSignals.market_comparison.find(item => item.brand === metadata.brand);
        const allCompetitors = llmSignals.market_comparison.filter(item => item.brand !== metadata.brand);
        return {
          brandSOV: mainBrandData?.brand_sov || 0,
          clusterCoverage: mainBrandData?.cluster_coverage || 0,
          competitorCount: allCompetitors.length
        };
      })();

      const criticalIssuesCount = Object.values(auditData.path_scorecard || {})
        .flatMap(data => data.scores || [])
        .filter(score => score.value < 0).length;

      const captureAndAdd = async (id, title) => {
        const element = document.getElementById(id);
        if (!element) {
          console.warn(`Element ${id} not found`);
          return;
        }

        const originalDisplay = element.style.display;
        const originalPosition = element.style.position;
        element.style.display = 'block';
        element.style.position = 'relative';

        const canvas = await html2canvas(element, {
          scale: 2,
          logging: false,
          useCORS: true,
          backgroundColor: '#ffffff'
        });

        element.style.display = originalDisplay;
        element.style.position = originalPosition;

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0; // Current y-offset in the image
        let pageNum = 1;

        while (heightLeft > 0) {
          // Add a new page for each segment
          pdf.addPage();

          // Header handling
          const headerSpace = 25;
          if (pageNum === 1 && title) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 41, 59);
            pdf.text(title.toUpperCase(), margin, 15);
            pdf.setDrawColor(226, 232, 240);
            pdf.line(margin, 18, margin + 60, 18);
          } else if (title) {
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 41, 59);
            pdf.text(`${title.toUpperCase()} (CONTINUED)`, margin, 15);
          }

          // Draw the image segment
          // We use a negative 'y' to show only the current segment
          // We also need to "hide" the parts that exceed the page height
          // jspdf.addImage(imgData, 'PNG', x, y, width, height)
          // The 'y' will be (headerSpace - position)
          pdf.addImage(imgData, 'PNG', margin, headerSpace - position, imgWidth, imgHeight);

          // Calculate space used on this page
          const usablePageHeight = pageHeight - headerSpace - 15; // 15 for bottom margin
          heightLeft -= usablePageHeight;
          position += usablePageHeight;
          pageNum++;

          // Draw a white rectangle at the bottom to cover overflow if needed
          // Or just rely on the next page covering it. jsPDF normally clips at page boundaries if we're careful.
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, pageHeight - 15, pageWidth, 15, 'F');

          // Also cover the top header area on subsequent pages to prevent image overlapping title
          if (pageNum > 2) {
            pdf.rect(0, 0, pageWidth, headerSpace - 1, 'F');
          }
        }
      };

      // COVER PAGE
      // Note: We don't call pdf.addPage() for the cover because jsPDF starts with one page.
      setProgress(10);
      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, 0, pageWidth, 100, 'F');

      pdf.setFontSize(36);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(37, 99, 235);
      pdf.text('AEO AUDIT', margin, 50);

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text('ANSWER ENGINE OPTIMIZATION READINESS REPORT', margin, 62);

      pdf.setDrawColor(37, 99, 235);
      pdf.setLineWidth(1.5);
      pdf.line(margin, 75, margin + 40, 75);

      pdf.setFontSize(22);
      pdf.setTextColor(30, 41, 59);
      pdf.setFont('helvetica', 'bold');
      pdf.text(auditData.audit_metadata?.brand.toUpperCase(), margin, 110);

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Domain: ${auditData.audit_metadata?.domain}`, margin, 120);
      pdf.text(`Region: ${auditData.audit_metadata?.location || 'Global'}`, margin, 127);
      pdf.text(`Audit Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, 134);

      const scoreValue = auditData.audit_metadata?.score_percentage || 0;
      pdf.setFillColor(scoreValue >= 90 ? 34 : scoreValue >= 75 ? 37 : 239, scoreValue >= 90 ? 197 : scoreValue >= 75 ? 99 : 68, scoreValue >= 90 ? 94 : scoreValue >= 75 ? 235 : 68);
      pdf.roundedRect(margin, 155, 50, 30, 3, 3, 'F');

      pdf.setFontSize(26);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`${scoreValue.toFixed(1)}%`, margin + 25, 175, { align: 'center' });
      pdf.setFontSize(9);
      pdf.text('AUDIT SCORE', margin + 25, 182, { align: 'center' });

      // SECTIONS
      const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
      const rawSections = [
        { id: 'pdf-summary', title: 'Executive Summary' },
        { id: 'pdf-score-overview', title: 'Overall Audit Performance' },
        { id: 'pdf-scorecards', title: 'Performance Benchmarks' },
        { id: 'pdf-remediations', title: 'Prioritized Remediation Strategy' },
        { id: 'pdf-domain', title: 'Technical Signal Compliance' },
        { id: 'pdf-market', title: 'Market Landscape Analysis' },
        { id: 'pdf-llm', title: 'AI Intent Cluster Analysis' },
        { id: 'pdf-audit-summary', title: 'Audit Summary & Evaluation' }
      ];

      const sections = rawSections.map((s, i) => ({
        ...s,
        title: `${roman[i]}. ${s.title}`
      }));

      for (let i = 0; i < sections.length; i++) {
        setProgress(20 + (i * (80 / sections.length)));
        await captureAndAdd(sections[i].id, sections[i].title);
      }

      // FOOTERS & PAGE NUMBERS
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`${auditData.audit_metadata?.brand} | AEO Technical Audit`, margin, pageHeight - 10);
        pdf.text(`Page ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }

      pdf.save(`AEO-AUDIT-REPORT-${auditData.audit_metadata?.brand.replace(/\s+/g, '-')}-${Date.now()}.pdf`);
      setProgress(100);
      if (onGeneratePDF) onGeneratePDF(true);
    } catch (e) {
      console.error('PDF Generation Error:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-8 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl border border-slate-700 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <SparklesIcon className="h-32 w-32 text-white" />
      </div>

      {/* HIDDEN PRINTABLE CONTAINER - THE STANDALONE REPORTING ENGINE */}
      <div
        style={{ position: 'absolute', left: '-9999px', top: '0', width: '800px' }}
        ref={printableRef}
      >
        <div id="pdf-summary" className="p-8 bg-white">
          <PrintableExecutiveSummary
            audit_metadata={auditData.audit_metadata}
            categories_count={Object.keys(auditData.path_scorecard || {}).length}
            critical_issues={Object.values(auditData.path_scorecard || {}).flatMap(d => d.scores || []).filter(s => s.value < 0).length}
            llmMetrics={(() => {
              const llm = auditData.signals?.llm_signals;
              if (!llm?.market_comparison) return null;
              const main = llm.market_comparison.find(item => item.brand === auditData.audit_metadata.brand);
              return {
                brandSOV: main?.brand_sov || 0,
                brandCitations: main?.brand_citations || 0,
                clusterCoverage: main?.cluster_coverage || 0,
                competitorCount: llm.market_comparison.length - 1
              };
            })()}
          />
        </div>
        <div id="pdf-score-overview" className="p-8 bg-white">
          <PrintableScoreOverview audit_metadata={auditData.audit_metadata} />
        </div>
        <div id="pdf-scorecards" className="p-8 bg-white">
          <PrintableScorecards
            auditData={auditData}
            llmMetrics={auditData.signals?.llm_signals}
            audit_metadata={auditData.audit_metadata}
          />
        </div>
        <div id="pdf-remediations" className="p-8 bg-white">
          <PrintableRemediations
            quickRemediations={auditData.quick_remediations}
            currentScore={auditData.audit_metadata?.score_percentage || 0}
            isUngated={isUngated}
          />
        </div>
        <div id="pdf-domain" className="p-8 bg-white">
          <PrintableDomainPanels
            categories={auditData.path_scorecard || {}}
            isUngated={isUngated}
          />
        </div>
        <div id="pdf-market" className="p-8 bg-white">
          <PrintableMarketComparison
            market_comparison={auditData.signals?.llm_signals?.market_comparison}
            brand={auditData.audit_metadata?.brand}
          />
        </div>
        <div id="pdf-llm" className="p-8 bg-white">
          <PrintableLLMAnalysis
            llmSignals={auditData.signals?.llm_signals}
            brand={auditData.audit_metadata?.brand}
            isUngated={isUngated}
          />
        </div>
        <div id="pdf-audit-summary" className="p-8 bg-white">
          <PrintableAuditSummary
            summary={auditData.summary}
            isUngated={isUngated}
          />
        </div>
      </div>

      <div className="text-center relative z-10">
        <div className="bg-blue-500/20 p-4 rounded-full inline-block mb-4 shadow-inner">
          <SparklesIcon className="h-10 w-10 text-blue-400" />
        </div>
        <h3 className="text-2xl font-black text-white mb-2">Generate Expert Analysis</h3>
        <p className="text-slate-400 text-sm max-w-sm mb-8 leading-relaxed">
          Proprietary audit data vectors mapped to a structured PDF report for executive stakeholders.
        </p>
      </div>

      {isGenerating && (
        <div className="w-full max-w-sm bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-inner mb-6 transition-all animate-pulse">
          <div className="flex justify-between text-[10px] font-black text-blue-400 mb-2 tracking-widest uppercase">
            <span>Parsing API Response Vectors...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-500 h-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Gated Toggle UI */}
      <div
        className="flex items-center space-x-3 mb-6 bg-slate-800/50 px-6 py-4 rounded-2xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-all select-none w-full max-w-sm"
        onClick={() => setIsUngated(!isUngated)}
      >
        <div className={`w-6 h-6 rounded-lg border-2 ${isUngated ? 'bg-blue-500 border-blue-500' : 'border-slate-500'} flex items-center justify-center transition-all shadow-lg`}>
          {isUngated && <CheckCircleIcon className="h-4 w-4 text-white" />}
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-white leading-tight">Ungated Report</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">{isUngated ? 'Full Expert Analysis Enabled' : 'Lead Gen / Gated Mode Enabled'}</p>
        </div>
      </div>

      <button
        onClick={generatePDF}
        disabled={isGenerating}
        className={`w-full max-w-sm flex items-center justify-center space-x-3 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all ${isGenerating
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
            : 'bg-white text-slate-900 hover:bg-blue-600 hover:text-white hover:scale-[1.02] active:scale-[0.98]'
          }`}
      >
        <DocumentArrowDownIcon className="h-5 w-5" />
        <span>{isGenerating ? 'Compiling Manifest...' : 'Download Detailed Report'}</span>
      </button>

      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-6 opacity-50">
        1Digitals AEO Engine • Pure Data Generation
      </p>
    </div>
  );
};

export default PDFReportGenerator;
