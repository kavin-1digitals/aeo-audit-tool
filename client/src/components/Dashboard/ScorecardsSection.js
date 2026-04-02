import React from 'react';

const ScorecardsSection = ({ auditData, llmMetrics, llmSignals, audit_metadata }) => {
  // Check if LLM signals are available - updated for new wrapper structure
  const hasLLMData = llmSignals && llmMetrics && llmSignals.signals && Object.keys(llmSignals.signals).length > 0 && llmSignals.status;
  
  // Check if site is scrapable
  // Note: isScrapable is available for future use if needed
  // const isScrapable = auditData?.site_signals?.is_scrapable || false;
  
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
    // Get clusters from citation_prompt_answers (7 clusters total) - use new structure
    // Handle both cases: citation_prompt_answers as array directly or with .root property
    const citationData = llmSignals?.signals?.citation_prompt_answers?.root || llmSignals?.signals?.citation_prompt_answers || llmMetrics?.citation_prompt_answers || [];
    let totalPrompts = 0;
    let brandCitations = 0;
    
    citationData.forEach(cluster => {
      // Count prompts in this cluster
      totalPrompts += cluster.prompts?.length || 0;
      
      // Count brand mentions in this cluster - use new structure
      cluster.prompts?.forEach(prompt => {
        if (prompt.web_entity_mentioned || prompt.llm_entity_mentioned) {
          brandCitations++;
        }
      });
    });
    
    if (totalPrompts === 0) return { score: 0, citations: 0, prompts: 0 };
    
    const visibilityScore = (brandCitations / totalPrompts) * 100;
    return { score: visibilityScore, citations: brandCitations, prompts: totalPrompts };
  };

  const getCompetitorCitationScore = () => {
    // Get clusters from citation_prompt_answers (7 clusters total) - use new structure
    // Handle both cases: citation_prompt_answers as array directly or with .root property
    const citationData = llmSignals?.signals?.citation_prompt_answers?.root || llmSignals?.signals?.citation_prompt_answers || llmMetrics?.citation_prompt_answers || [];
    let totalPrompts = 0;
    
    // Track citations per competitor
    const competitorCitations = {};
    
    citationData.forEach(cluster => {
      // Count prompts in this cluster
      totalPrompts += cluster.prompts?.length || 0;
      
      // Count competitor mentions in this cluster - use new structure
      cluster.prompts?.forEach(prompt => {
        // Get unique competitors mentioned in either web or llm citations (count each competitor only once per prompt)
        const webCompetitors = new Set();
        const llmCompetitors = new Set();
        
        // Collect web competitors
        (prompt.competitor_citations_web || []).forEach(citation => {
          if (citation.is_competitor_mentioned) {
            webCompetitors.add(citation.competitor_entity);
          }
        });
        
        // Collect LLM competitors
        (prompt.competitor_citations_llm || []).forEach(citation => {
          if (citation.is_competitor_mentioned) {
            llmCompetitors.add(citation.competitor_entity);
          }
        });
        
        // Combine unique competitors from both web and LLM (count each competitor only once per prompt)
        const uniqueCompetitors = new Set([...webCompetitors, ...llmCompetitors]);
        
        uniqueCompetitors.forEach(competitor => {
          competitorCitations[competitor] = (competitorCitations[competitor] || 0) + 1;
        });
      });
    });
    
    // Find the best competitor (highest citations)
    const competitorValues = Object.values(competitorCitations);
    const bestCompetitorCitations = competitorValues.length > 0 ? Math.max(...competitorValues) : 0;
    
    console.log('ScorecardsSection getCompetitorCitationScore Debug:', {
      competitorCitations,
      competitorValues,
      bestCompetitorCitations,
      totalPrompts
    });
    
    if (totalPrompts === 0) return { score: 0, citations: 0, prompts: 0 };
    
    const competitorScore = (bestCompetitorCitations / totalPrompts) * 100;
    return { score: competitorScore, citations: bestCompetitorCitations, prompts: totalPrompts };
  };

  const getPagesAnalyzed = () => {
    const pagesCount = auditData?.signals?.site_signals?.site_signals?.length || 0;
    return { score: pagesCount, count: pagesCount };
  };

  const getPromptsUsed = () => {
    // Count total prompts across all clusters (7 clusters) - use new structure
    // Handle both cases: citation_prompt_answers as array directly or with .root property
    const citationData = llmSignals?.signals?.citation_prompt_answers?.root || llmSignals?.signals?.citation_prompt_answers || llmMetrics?.citation_prompt_answers || [];
    let totalPrompts = 0;
    
    citationData.forEach(cluster => {
      totalPrompts += cluster.prompts?.length || 0;
    });
    
    return { score: totalPrompts, count: totalPrompts };
  };

  const getClustersCovered = () => {
    // Calculate coverage directly from raw data instead of using backend's potentially incorrect calculation
    const citationData = llmSignals?.signals?.citation_prompt_answers?.root || llmSignals?.signals?.citation_prompt_answers || llmMetrics?.citation_prompt_answers || [];
    // const brand = audit_metadata.brand; // Available for future use if needed
    
    let coveredClusters = 0;
    const totalClusters = citationData.length;
    
    citationData.forEach(cluster => {
      // Check if brand is mentioned in any prompt within this cluster (web or llm)
      const brandMentioned = cluster.prompts?.some(prompt => 
        prompt.web_entity_mentioned || prompt.llm_entity_mentioned
      );
      
      if (brandMentioned) {
        coveredClusters++;
      }
    });
    
    // Calculate correct percentage
    const coverage = totalClusters > 0 ? Math.round((coveredClusters / totalClusters) * 100 * 10) / 10 : 0;
    
    return { score: coverage, count: coveredClusters };
  };

  const getCompetitorsIdentified = () => {
    // Try multiple approaches like ProfessionalCharts does
    const directCompetitors = llmSignals?.signals?.competitors || [];
    const marketCompetitors = llmSignals?.signals?.market_comparison_combined?.filter(item => item.entity !== audit_metadata.brand) || [];
    
    // Use the direct competitors list first, fallback to market comparison
    const competitorsList = directCompetitors.length > 0 ? directCompetitors : marketCompetitors.map(c => c.entity);
    const competitorsCount = Array.isArray(competitorsList) ? Math.max(0, competitorsList.length) : 0;
    
    console.log('ScorecardsSection getCompetitorsIdentified Debug:', {
      directCompetitors,
      marketCompetitors,
      competitorsList,
      competitorsCount,
      llmSignals: llmSignals?.signals
    });
    
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
          <div className={`text-3xl font-bold ${hasLLMData ? 'text-gray-900' : 'text-red-500'}`}>
            {hasLLMData ? `${aiPromptVisibility.score.toFixed(1)}%` : '--'}
          </div>
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
              {hasLLMData && (
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
              )}
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-600">
          {hasLLMData 
            ? `Brand mentioned in ${aiPromptVisibility.citations} of ${aiPromptVisibility.prompts} AI conversation prompts across 7 user intent clusters, measuring brand visibility in AI responses`
            : 'Brand visibility in AI conversation prompts across user intent clusters, measuring how often your brand appears in AI responses'
          }
        </p>
      </div>

      {/* Competitor Citation Score */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Competitor Citation Score</h3>
        <div className="flex items-center justify-between mb-3">
          <div className={`text-3xl font-bold ${hasLLMData ? 'text-gray-900' : 'text-red-500'}`}>
            {hasLLMData ? `${competitorCitationScore.score.toFixed(1)}%` : '--'}
          </div>
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
              {hasLLMData && (
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
              )}
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-600">
          {hasLLMData 
            ? `Best performing competitor mentioned in ${competitorCitationScore.citations} of ${competitorCitationScore.prompts} AI prompts, showing competitive benchmark and market dominance`
            : 'Competitive benchmark showing how often top competitors appear in AI responses compared to your brand'
          }
        </p>
      </div>

      {/* Clusters Covered */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Clusters Covered</h3>
        <div className="flex items-center justify-between mb-3">
          <div className={`text-3xl font-bold ${hasLLMData ? 'text-gray-900' : 'text-red-500'}`}>
            {hasLLMData ? `${clustersCovered.score.toFixed(1)}%` : '--'}
          </div>
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
              {hasLLMData && (
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
              )}
            </svg>
          </div>
        </div>
        <p className="text-xs text-gray-600">
          {hasLLMData 
            ? `Brand presence across user intent clusters, showing content strategy breadth and coverage across different user search intents`
            : 'Brand presence across user intent clusters, showing content strategy breadth and coverage across different user search intents'
          }
        </p>
      </div>

      {/* Pages Analyzed */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Pages Analyzed</h3>
        <div className="text-3xl font-bold mb-3 text-gray-900">
          {pagesAnalyzed.score}
        </div>
        <p className="text-xs text-gray-600">Website pages crawled for content analysis</p>
      </div>

      {/* Prompts Used */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Prompts Used</h3>
        <div className={`text-3xl font-bold mb-3 ${hasLLMData ? 'text-gray-900' : 'text-red-500'}`}>
          {hasLLMData ? promptsUsed.score : '--'}
        </div>
        <p className="text-xs text-gray-600">AI conversation prompts used for brand visibility testing</p>
      </div>

      {/* Competitors Identified */}
      <div className="bg-white rounded-lg shadow border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Competitors Identified</h3>
        <div className={`text-3xl font-bold mb-3 ${hasLLMData ? 'text-gray-900' : 'text-red-500'}`}>
          {hasLLMData ? competitorsIdentified.score : '--'}
        </div>
        <p className="text-xs text-gray-600">Competing brands identified in your market landscape</p>
      </div>

    </div>
  );
};

export default ScorecardsSection;
