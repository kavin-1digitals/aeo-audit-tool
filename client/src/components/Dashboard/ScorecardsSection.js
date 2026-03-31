import React from 'react';

const ScorecardsSection = ({ auditData, llmMetrics, llmSignals, audit_metadata }) => {
  // Calculate scorecards data
  const getTechnicalReadiness = () => {
    // Get domain and site signals from path_scorecard
    const pathScorecard = auditData?.path_scorecard || {};
    
    // Find domain and site signal categories
    const domainSignals = Object.values(pathScorecard).filter(item => 
      item.signal_path && item.signal_path[0] === 'Domain Signals'
    );
    const siteSignals = Object.values(pathScorecard).filter(item => 
      item.signal_path && item.signal_path[0] === 'Site Signals'
    );
    
    // Get all technical scores from domain and site
    const allTechnicalScores = [
      ...(domainSignals.flatMap(item => item.scores || [])),
      ...(siteSignals.flatMap(item => item.scores || []))
    ];
    
    if (allTechnicalScores.length === 0) return { score: 0, count: 0 };
    
    // Count positive scores (value > 0, exclude -1 for non-scrapable sites)
    const positiveScores = allTechnicalScores.filter(score => score.value > 0).length;
    const readinessScore = (positiveScores / allTechnicalScores.length) * 100;
    
    return { score: readinessScore, count: allTechnicalScores.length };
  };

  const getAIPromptVisibility = () => {
    // Get clusters from citation_prompt_answers (7 clusters total)
    const clusters = llmMetrics?.citation_prompt_answers || [];
    let totalPrompts = 0;
    let brandCitations = 0;
    
    clusters.forEach(cluster => {
      // Count prompts in this cluster
      totalPrompts += cluster.prompts?.length || 0;
      
      // Count brand mentions in this cluster
      cluster.prompts?.forEach(prompt => {
        if (prompt.is_brand_mentioned) {
          brandCitations++;
        }
      });
    });
    
    if (totalPrompts === 0) return { score: 0, citations: 0, prompts: 0 };
    
    const visibilityScore = (brandCitations / totalPrompts) * 100;
    return { score: visibilityScore, citations: brandCitations, prompts: totalPrompts };
  };

  const getCompetitorCitationScore = () => {
    // Get clusters from citation_prompt_answers (7 clusters total)
    const clusters = llmMetrics?.citation_prompt_answers || [];
    let totalPrompts = 0;
    
    // Track citations per competitor
    const competitorCitations = {};
    
    clusters.forEach(cluster => {
      // Count prompts in this cluster
      totalPrompts += cluster.prompts?.length || 0;
      
      // Count competitor mentions in this cluster
      cluster.prompts?.forEach(prompt => {
        prompt.competitor_citations?.forEach(citation => {
          if (citation.is_competitor_mentioned) {
            const competitor = citation.competitor_brand;
            competitorCitations[competitor] = (competitorCitations[competitor] || 0) + 1;
          }
        });
      });
    });
    
    // Find the best competitor (highest citations)
    const bestCompetitorCitations = Math.max(0, ...Object.values(competitorCitations));
    
    if (totalPrompts === 0) return { score: 0, citations: 0, prompts: 0 };
    
    const competitorScore = (bestCompetitorCitations / totalPrompts) * 100;
    return { score: competitorScore, citations: bestCompetitorCitations, prompts: totalPrompts };
  };

  const getPagesAnalyzed = () => {
    const pagesCount = auditData?.signals?.site_signals?.site_signals?.length || 0;
    return { score: pagesCount, count: pagesCount };
  };

  const getPromptsUsed = () => {
    // Count total prompts across all clusters (7 clusters)
    const clusters = llmMetrics?.citation_prompt_answers || [];
    let totalPrompts = 0;
    
    clusters.forEach(cluster => {
      totalPrompts += cluster.prompts?.length || 0;
    });
    
    return { score: totalPrompts, count: totalPrompts };
  };

  const getClustersCovered = () => {
    // Get brand coverage from market_comparison
    const marketData = llmMetrics?.market_comparison || [];
    const mainBrandData = marketData.find(item => item.brand === audit_metadata.brand) || {
      cluster_coverage: 0
    };
    
    const coverage = mainBrandData.cluster_coverage || 0;
    const totalClusters = llmMetrics?.citation_prompt_answers?.length || 0;
    const coveredClusters = Math.round((coverage / 100) * totalClusters);
    
    return { score: coverage, count: coveredClusters };
  };

  const getCompetitorsIdentified = () => {
    const competitorsCount = llmSignals?.competitors?.length || 0;
    return { score: competitorsCount, count: competitorsCount };
  };

  const technicalReadiness = getTechnicalReadiness();
  const aiPromptVisibility = getAIPromptVisibility();
  const competitorCitationScore = getCompetitorCitationScore();
  const pagesAnalyzed = getPagesAnalyzed();
  const promptsUsed = getPromptsUsed();
  const clustersCovered = getClustersCovered();
  const competitorsIdentified = getCompetitorsIdentified();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
      
      {/* Technical Readiness */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Technical Readiness</h3>
        <div className="flex items-center justify-between mb-3">
          <div className="text-3xl font-bold text-gray-900">{technicalReadiness.score.toFixed(0)}%</div>
          <div className="relative w-16 h-16">
            <svg className="transform -rotate-90 w-16 h-16">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="6"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="6"
                strokeDasharray={`${technicalReadiness.score * 1.76} 176`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-600">Domain optimization (llms.txt, robots.txt, sitemap) + Site signals (canonical, JSON-LD, scrapability) blended score across {technicalReadiness.count} technical checks</p>
      </div>

      {/* AI Prompt Visibility */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">AI Prompt Visibility</h3>
        <div className="flex items-center justify-between mb-3">
          <div className="text-3xl font-bold text-gray-900">{aiPromptVisibility.score.toFixed(1)}%</div>
          <div className="relative w-16 h-16">
            <svg className="transform -rotate-90 w-16 h-16">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="6"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="6"
                strokeDasharray={`${aiPromptVisibility.score * 1.76} 176`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-600">Brand mentioned in {aiPromptVisibility.citations} of {aiPromptVisibility.prompts} AI conversation prompts across 7 user intent clusters, measuring brand visibility in AI responses</p>
      </div>

      {/* Competitor Citation Score */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Competitor Citation Score</h3>
        <div className="flex items-center justify-between mb-3">
          <div className="text-3xl font-bold text-gray-900">{competitorCitationScore.score.toFixed(1)}%</div>
          <div className="relative w-16 h-16">
            <svg className="transform -rotate-90 w-16 h-16">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="6"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#ef4444"
                strokeWidth="6"
                strokeDasharray={`${competitorCitationScore.score * 1.76} 176`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-600">Best performing competitor mentioned in {competitorCitationScore.citations} of {competitorCitationScore.prompts} AI prompts, showing competitive benchmark and market dominance</p>
      </div>

      {/* Clusters Covered */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Clusters Covered</h3>
        <div className="flex items-center justify-between mb-3">
          <div className="text-3xl font-bold text-gray-900">{clustersCovered.score.toFixed(1)}%</div>
          <div className="relative w-16 h-16">
            <svg className="transform -rotate-90 w-16 h-16">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="6"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="6"
                strokeDasharray={`${clustersCovered.score * 1.76} 176`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-600">Brand presence across {clustersCovered.count} of 7 user intent clusters, showing content strategy breadth and coverage across different user search intents</p>
      </div>

      {/* Pages Analyzed */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Pages Analyzed</h3>
        <div className="text-3xl font-bold text-gray-900 mb-3">{pagesAnalyzed.score}</div>
        <p className="text-xs text-gray-600">Website pages crawled for content analysis</p>
      </div>

      {/* Prompts Used */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Prompts Used</h3>
        <div className="text-3xl font-bold text-gray-900 mb-3">{promptsUsed.score}</div>
        <p className="text-xs text-gray-600">AI conversation prompts used for brand visibility testing</p>
      </div>

      {/* Competitors Identified */}
      <div className="bg-white rounded-lg shadow border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Competitors Identified</h3>
        <div className="text-3xl font-bold text-gray-900 mb-3">{competitorsIdentified.score}</div>
        <p className="text-xs text-gray-600">Competing brands identified in your market landscape</p>
      </div>

    </div>
  );
};

export default ScorecardsSection;
