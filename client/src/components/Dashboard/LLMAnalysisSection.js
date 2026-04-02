import React, { useState, useMemo } from 'react';
import {
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  UserGroupIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';

const LLMAnalysisSection = ({ llmSignals, audit_metadata }) => {
  const [selectedCluster, setSelectedCluster] = useState(0);
  const [selectedQuery, setSelectedQuery] = useState(0);

  // Check if we have valid LLM signals data with the new structure
  // Handle both cases: citation_prompt_answers as array directly or with .root property
  const citationData = llmSignals?.signals?.citation_prompt_answers?.root || llmSignals?.signals?.citation_prompt_answers;
  
  if (!citationData?.length) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg border border-purple-100 p-12">
        <div className="text-center text-gray-500">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-md mb-4">
            <ChatBubbleLeftRightIcon className="h-10 w-10 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No LLM Signal Data Available
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Try running a new audit to see AI conversation analysis
          </p>
        </div>
      </div>
    );
  }

  const clusters = citationData; // Use the citationData directly
  const currentCluster = clusters[selectedCluster];
  const currentPrompt = currentCluster.prompts[selectedQuery];
  const brand = audit_metadata.brand;
  const competitors = llmSignals.signals.competitors || [];

  const highlightText = (text, brand, competitors) => {
    let highlightedText = text;
    
    // Convert markdown links [text](url) to HTML links
    highlightedText = highlightedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800">$1</a>');
    
    // Only convert bullet points if they exist, and wrap them properly
    if (highlightedText.includes('• ')) {
      // Split by lines and process bullet points
      const lines = highlightedText.split('\n');
      const processedLines = lines.map(line => {
        if (line.trim().startsWith('• ')) {
          // Remove the • and wrap in li, then add the • back as content
          const content = line.trim().substring(2); // Remove "• "
          return `<li class="ml-4 my-1">• ${content}</li>`;
        }
        return line;
      });
      
      // Join back and wrap bullet sections in ul tags (without list-disc to avoid double bullets)
      highlightedText = processedLines.join('\n');
      highlightedText = highlightedText.replace(/(<li[^>]*>.*<\/li>\s*)+/gs, '<ul class="list-inside my-2 space-y-1 ml-4">$&</ul>');
    }
    
    highlightedText = highlightedText.replace(
      new RegExp(`\\b(${brand})\\b`, 'gi'), 
      '<span class="brand-highlight">$1</span>'
    );
    
    competitors.forEach(competitor => {
      highlightedText = highlightedText.replace(
        new RegExp(`\\b(${competitor})\\b`, 'gi'),
        '<span class="competitor-highlight">$1</span>'
      );
    });
    
    return highlightedText;
  };

  const getClusterIcon = (clusterName) => {
    const icons = {
      'Fashion': '👗',
      'Quality': '⭐',
      'Pricing': '💰',
      'Style': '🎨',
      'Fit': '👕',
      'Trends': '📈',
      'Value': '💎',
      'Durability': '🛡️',
      'Comfort': '☁️',
      'Design': '✨',
      'Material': '🧵',
      'Brand': '🏷️'
    };
    return icons[clusterName.split(' ')[0]] || '📁';
  };

  const calculateClusterStats = (cluster) => {
    // Update for new structure: check both web_entity_mentioned and llm_entity_mentioned
    const brandMentions = cluster.prompts.filter(p => p.web_entity_mentioned || p.llm_entity_mentioned).length;
    
    // Update for new structure: competitor citations are now split into web and llm arrays
    const competitorMentions = cluster.prompts.reduce((acc, prompt) => {
      const webCompetitorMentions = (prompt.competitor_citations_web || []).filter(c => c.is_competitor_mentioned).length;
      const llmCompetitorMentions = (prompt.competitor_citations_llm || []).filter(c => c.is_competitor_mentioned).length;
      return acc + webCompetitorMentions + llmCompetitorMentions;
    }, 0);
    
    return {
      brandMentions,
      competitorMentions,
      totalQueries: cluster.prompts.length,
      brandCoverage: (brandMentions / cluster.prompts.length) * 100
    };
  };

  const clusterStats = calculateClusterStats(currentCluster);
  // Update for new structure: access market_comparison_combined from signals
  const brandSOV = llmSignals.signals.market_comparison_combined?.find(m => m.entity === brand)?.sov || 0;

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">GenAI Analysis</h3>
        <p className="text-sm text-gray-600 mt-1">
          AI conversation insights across {clusters.length} intent clusters
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Enhanced Cluster Navigation */}
        <div className="lg:col-span-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Intent Clusters</h4>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{clusters.length}</span>
            </div>
            {clusters.map((cluster, index) => {
              const stats = calculateClusterStats(cluster);
              return (
                <div
                  key={cluster.cluster}
                  className={`group relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    selectedCluster === index
                      ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-purple-300 hover:shadow-sm bg-white'
                  }`}
                  onClick={() => {
                    setSelectedCluster(index);
                    setSelectedQuery(0);
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl flex-shrink-0">
                      {getClusterIcon(cluster.cluster)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-semibold text-gray-900 truncate mb-2">
                        {cluster.cluster}
                      </h5>
                      
                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">Coverage</span>
                          <span className={`font-semibold ${stats.brandCoverage >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                            {stats.brandCoverage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              stats.brandCoverage >= 75 ? 'bg-green-500' :
                              stats.brandCoverage >= 50 ? 'bg-blue-500' :
                              stats.brandCoverage >= 25 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${stats.brandCoverage}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {stats.brandMentions}/{stats.totalQueries} queries
                        </span>
                        <div className="flex items-center">
                          {(currentCluster.prompts.some(p => p.web_entity_mentioned || p.llm_entity_mentioned)) ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  {selectedCluster === index && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 rounded-l-xl"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enhanced Query Display */}
        <div className="lg:col-span-6">
          <div className="space-y-4">
            {/* Enhanced Query Navigation */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedQuery(Math.max(0, selectedQuery - 1))}
                  disabled={selectedQuery === 0}
                  className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-50 hover:border-purple-300 transition-colors shadow-sm"
                >
                  <ArrowLeftIcon className="h-4 w-4 text-gray-700" />
                </button>
                
                <div className="flex items-center space-x-1">
                  {currentCluster.prompts.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedQuery(index)}
                      className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        selectedQuery === index
                          ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-md scale-110'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setSelectedQuery(Math.min(currentCluster.prompts.length - 1, selectedQuery + 1))}
                  disabled={selectedQuery === currentCluster.prompts.length - 1}
                  className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-50 hover:border-purple-300 transition-colors shadow-sm"
                >
                  <ArrowRightIcon className="h-4 w-4 text-gray-700" />
                </button>
              </div>
              
              <span className="text-sm font-medium text-gray-600 bg-white px-3 py-1 rounded-full border border-gray-200">
                Query {selectedQuery + 1} of {currentCluster.prompts.length}
              </span>
            </div>

            {/* Question Card */}
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                  <span className="text-lg">❓</span>
                </div>
                <div className="flex-1">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">User Question</h5>
                  <p className="text-gray-800 font-medium leading-relaxed">{currentPrompt.prompt}</p>
                </div>
              </div>
            </div>

              {/* LLM Answer with Web Search Tool */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200 shadow-md">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-200 rounded-lg flex items-center justify-center">
                    <SparklesIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">
                      AI Response
                      <span className="ml-4 text-xs font-normal text-gray-500">
                        {currentPrompt.llm_entity_mentioned ? (
                          <span className="text-green-600">✓ Brand mentioned</span>
                        ) : (
                          <span className="text-red-600">✗ Brand not mentioned</span>
                        )}
                      </span>
                    </h5>
                    <div 
                      className="text-gray-800 leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightText(currentPrompt.llm_answer || 'No AI response available', brand, competitors) 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-4"></div> {/* Spacer between responses */}

            {/* Answer Cards - Web Search and LLM */}
            <div className="space-y-4">
              {/* Web Search Answer */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200 shadow-md">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-200 rounded-lg flex items-center justify-center">
                    <span className="text-lg">🌐</span>
                  </div>
                  <div className="flex-1">
                    <h5 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">
                      AI Response [Web Search Tool]
                      <span className="ml-4 text-xs font-normal text-gray-500">
                        {currentPrompt.web_entity_mentioned ? (
                          <span className="text-green-600">✓ Brand mentioned</span>
                        ) : (
                          <span className="text-red-600">✗ Brand not mentioned</span>
                        )}
                      </span>
                    </h5>
                    <div 
                      className="text-gray-800 leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightText(currentPrompt.web_answer || 'No web search response available', brand, competitors) 
                      }}
                    />
                  </div>
                </div>
              </div>

            {/* Insights Alert */}
            {!(currentPrompt.web_entity_mentioned || currentPrompt.llm_entity_mentioned) && (
              <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-4 flex items-start space-x-3">
                <LightBulbIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h6 className="text-sm font-semibold text-amber-800 mb-1">Opportunity Detected</h6>
                  <p className="text-xs text-amber-700">
                    Your brand was not mentioned in this response. Consider optimizing content for this query intent.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Insights Panel */}
        <div className="lg:col-span-3">
          <div className="space-y-4">
            {/* Cluster Performance Card */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 shadow-sm">
              <h5 className="text-sm font-semibold text-purple-900 mb-4 flex items-center">
                <ChartBarIcon className="h-4 w-4 mr-2" />
                Cluster Metrics
              </h5>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 font-medium">Coverage</span>
                    <span className={`text-lg font-bold ${clusterStats.brandCoverage >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                      {clusterStats.brandCoverage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 font-medium">Brand Mentions</span>
                    <span className="text-lg font-bold text-gray-900">
                      {clusterStats.brandMentions}<span className="text-sm text-gray-500">/{clusterStats.totalQueries}</span>
                    </span>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 font-medium">Competitor Mentions</span>
                    <span className="text-lg font-bold text-orange-600">
                      {clusterStats.competitorMentions}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Share Card */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <h5 className="text-sm font-semibold mb-3 flex items-center text-gray-900">
                <UserGroupIcon className="h-4 w-4 mr-2" />
                Market Share of Voice
              </h5>
              <div className="text-center py-2">
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {brandSOV.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">Overall Brand SOV</div>
              </div>
            </div>

            {/* Mention Status Card */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <h5 className="text-sm font-semibold text-gray-900 mb-4">Current Query Status</h5>
              <div className="space-y-3">
                {/* Brand Status */}
                <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">{brand}</span>
                  <div className="flex items-center space-x-1 ml-auto">
                    {/* Web Search Status */}
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                      currentPrompt.web_entity_mentioned ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      <span>Web</span>
                      <span>{currentPrompt.web_entity_mentioned ? '✓' : '✗'}</span>
                    </div>
                    {/* LLM Status */}
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                      currentPrompt.llm_entity_mentioned ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      <span>AI</span>
                      <span>{currentPrompt.llm_entity_mentioned ? '✓' : '✗'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Competitor Status - Consolidated */}
                {(() => {
                  // Get all unique competitors and their mention counts
                  const competitorStatus = {};
                  
                  // Process web search citations
                  (currentPrompt.competitor_citations_web || []).forEach(citation => {
                    const competitor = citation.competitor_entity;
                    if (!competitorStatus[competitor]) {
                      competitorStatus[competitor] = { web: false, llm: false, count: 0 };
                    }
                    if (citation.is_competitor_mentioned) {
                      competitorStatus[competitor].web = true;
                      competitorStatus[competitor].count++;
                    }
                  });
                  
                  // Process LLM citations
                  (currentPrompt.competitor_citations_llm || []).forEach(citation => {
                    const competitor = citation.competitor_entity;
                    if (!competitorStatus[competitor]) {
                      competitorStatus[competitor] = { web: false, llm: false, count: 0 };
                    }
                    if (citation.is_competitor_mentioned) {
                      competitorStatus[competitor].llm = true;
                      competitorStatus[competitor].count++;
                    }
                  });
                  
                  return Object.entries(competitorStatus).map(([competitor, status]) => (
                    <div 
                      key={competitor} 
                      className={`flex items-center space-x-2 p-2 rounded-lg ${
                        status.count > 0 ? 'bg-orange-50' : 'bg-gray-50'
                      }`}
                    >
                      <span className={`text-sm font-medium ${
                        status.count > 0 ? 'text-orange-700' : 'text-gray-600'
                      }`}>
                        {competitor}
                      </span>
                      <div className="flex items-center space-x-1 ml-auto">
                        {/* Type indicators with text labels */}
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                          status.web ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          <span>Web</span>
                          <span>{status.web ? '✓' : '✗'}</span>
                        </div>
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                          status.llm ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          <span>AI</span>
                          <span>{status.llm ? '✓' : '✗'}</span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .brand-highlight {
          background: linear-gradient(120deg, #DBEAFE 0%, #BFDBFE 100%);
          color: #1E40AF;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #93C5FD;
          box-shadow: 0 1px 2px rgba(59, 130, 246, 0.1);
        }
        .competitor-highlight {
          background: linear-gradient(120deg, #FEE2E2 0%, #FECACA 100%);
          color: #DC2626;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #FCA5A5;
          box-shadow: 0 1px 2px rgba(239, 68, 68, 0.1);
        }
      `}</style>
    </div>
  );
};

export default LLMAnalysisSection;