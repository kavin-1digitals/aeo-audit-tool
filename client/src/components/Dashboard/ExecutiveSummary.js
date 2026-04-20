import React from 'react';
import {
  CalendarIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const ExecutiveSummary = ({ audit_metadata, total_checks, categories_count, critical_issues, llmMetrics, llmSignals, auditData }) => {
  // Check if LLM signals are available - updated to match ScorecardsSection pattern
  const hasLLMData = llmSignals && llmMetrics && 
    (llmSignals?.signals?.citation_prompt_answers?.root?.length > 0 || 
     llmSignals?.signals?.citation_prompt_answers?.length > 0 || 
     llmMetrics?.citation_prompt_answers?.length > 0) &&
    auditData?.signals?.llm_signals?.status;
  
  // Calculate metrics the same way as ScorecardsSection - updated for new structure
  const getAIPromptVisibility = () => {
    // Handle both cases: citation_prompt_answers as array directly or with .root property (same as ScorecardsSection)
    const citationData = llmSignals?.signals?.citation_prompt_answers?.root || llmSignals?.signals?.citation_prompt_answers || llmMetrics?.citation_prompt_answers || [];
    let totalPrompts = 0;
    let brandCitations = 0;
    
    citationData.forEach(cluster => {
      totalPrompts += cluster.prompts?.length || 0;
      cluster.prompts?.forEach(prompt => {
        // Check both web and llm entity mentions (new structure)
        if (prompt.web_entity_mentioned || prompt.llm_entity_mentioned) {
          brandCitations++;
        }
      });
    });
    
    return totalPrompts > 0 ? (brandCitations / totalPrompts) * 100 : 0;
  };

  const getClustersCovered = () => {
    // Handle new structure with market_comparison_combined (same as ScorecardsSection)
    const marketData = llmMetrics?.market_comparison_combined || llmMetrics?.market_comparison || [];
    const mainBrandData = marketData.find(item => item.entity === audit_metadata.brand) || {
      cluster_coverage: 0
    };
    
    return mainBrandData.cluster_coverage || 0;
  };

  const getBrandCitations = () => {
    // Handle both cases: citation_prompt_answers as array directly or with .root property (same as ScorecardsSection)
    const citationData = llmSignals?.signals?.citation_prompt_answers?.root || llmSignals?.signals?.citation_prompt_answers || llmMetrics?.citation_prompt_answers || [];
    let brandCitations = 0;
    
    citationData.forEach(cluster => {
      cluster.prompts?.forEach(prompt => {
        // Check both web and llm entity mentions (new structure)
        if (prompt.web_entity_mentioned || prompt.llm_entity_mentioned) {
          brandCitations++;
        }
      });
    });
    
    return brandCitations;
  };

  // Use real LLM metrics if available, otherwise use fallback values - updated for new structure
  const getLLMMetrics = () => {
    if (hasLLMData) {
      // Get brand SOV from market_comparison_combined (new structure) - same as Dashboard.js
      const marketData = llmSignals?.signals?.market_comparison_combined || llmMetrics?.market_comparison || [];
      const mainBrandData = marketData.find(item => item.entity === audit_metadata.brand) || {
        sov: 0,
        citations: 0,
        cluster_coverage: 0
      };
      
      console.log('ExecutiveSummary getLLMMetrics Debug:', {
        marketData,
        mainBrandData,
        brand: audit_metadata.brand,
        llmSignals: llmSignals?.signals
      });
      
      return {
        brandSOV: mainBrandData.sov || 0,
        brandCitations: getBrandCitations(),
        clusterCoverage: mainBrandData.cluster_coverage || 0 // Use the value from market_comparison_combined
      };
    }
    
    // Fallback values if no LLM data available
    return {
      brandSOV: null,
      brandCitations: null,
      clusterCoverage: null
    };
  };

  const metrics = getLLMMetrics();
  
  // Debug logging to help identify issues
  console.log('ExecutiveSummary Debug:', {
    hasLLMData,
    llmSignals,
    llmMetrics,
    metrics,
    auditDataSignals: auditData?.signals?.llm_signals
  });
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const getHealthStatus = (score) => {
    if (score >= 90) return { status: 'Excellent', color: 'text-green-600 bg-green-100' };
    if (score >= 80) return { status: 'Good', color: 'text-blue-600 bg-blue-100' };
    if (score >= 70) return { status: 'Fair', color: 'text-yellow-600 bg-yellow-100' };
    if (score >= 60) return { status: 'Poor', color: 'text-orange-600 bg-orange-100' };
    return { status: 'Critical', color: 'text-red-600 bg-red-100' };
  };

  const healthStatus = getHealthStatus(audit_metadata?.percentage || audit_metadata?.score_percentage || 0);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Executive Summary</h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${healthStatus.color}`}>
            {healthStatus.status}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Business Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wider">Business Details</h4>
            <div className="space-y-3">
              <div className="flex items-start">
                <GlobeAltIcon className="h-5 w-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Domain</p>
                  <p className="text-sm text-gray-600">{audit_metadata.domain}</p>
                </div>
              </div>
              <div className="flex items-start">
                <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Brand</p>
                  <p className="text-sm text-gray-600">{audit_metadata.brand}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wider">Audit Details</h4>
            <div className="space-y-3">
              <div className="flex items-start">
                <CalendarIcon className="h-5 w-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Audit Date</p>
                  <p className="text-sm text-gray-600">{currentDate}</p>
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Categories Tested</p>
                  <p className="text-sm text-gray-600">{categories_count} categories Analysed</p>
                </div>
              </div>
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Critical Issues</p>
                  <p className="text-sm text-gray-600">{critical_issues} items need attention</p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Overview */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wider">Performance Overview</h4>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Brand SOV</p>
                <div className="flex items-center mt-1">
                  <div className={`text-2xl font-bold ${hasLLMData ? 'text-gray-900' : 'text-red-500'}`}>
                    {hasLLMData ? `${metrics.brandSOV.toFixed(1)}%` : '--'}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Brand Citations</p>
                <p className={`text-sm ${hasLLMData ? 'text-gray-600' : 'text-red-500'}`}>
                  {hasLLMData ? `${metrics.brandCitations} citations found` : '-- citations found'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Cluster Coverage</p>
                <p className={`text-sm ${hasLLMData ? 'text-gray-600' : 'text-red-500'}`}>
                  {hasLLMData ? `${metrics.clusterCoverage.toFixed(1)}% coverage` : '--% coverage'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Geographic Information */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Geographic Focus</p>
              <p className="text-sm text-gray-600">{audit_metadata.geo}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">Market Analysis</p>
              <p className="text-sm text-gray-600">LLM Brand Analysis included</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveSummary;
