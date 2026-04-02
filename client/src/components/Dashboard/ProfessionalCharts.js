import React from 'react';
import { 
  ChartBarIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline';

const ProfessionalCharts = ({ llmMetrics, audit_metadata, llmSignals, auditData }) => {
  console.log('=== PROFESSIONAL CHARTS DEBUG ===');
  console.log('llmMetrics:', llmMetrics);
  console.log('llmSignals:', llmSignals);

  // Check if LLM data is available - updated for new structure
  const hasLLMData = llmSignals && llmMetrics && Object.keys(llmSignals).length > 0 && auditData?.signals?.llm_signals?.status;

  // Handle low confidence case
  if (llmSignals?.low_confidence_reasoning) {
    return (
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-[65%] bg-white rounded-lg shadow border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Market Comparison</h4>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
              <ExclamationTriangleIcon className="h-8 w-8 text-amber-600" />
            </div>
            
            <h4 className="text-lg font-semibold text-amber-800 mb-2">Limited Brand Analysis Available</h4>
            <p className="text-sm text-amber-700 mb-4 max-w-md mx-auto">
              Limited brand information available for comprehensive AI conversation analysis
            </p>
            
            <div className="bg-white rounded-lg p-4 border border-amber-200 text-left max-w-sm mx-auto">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600 font-medium">Confidence Score</div>
                <div className="text-lg font-bold text-gray-900">
                  {llmSignals.signals.entity_analysis ? `${(llmSignals.signals.entity_analysis.entity_confidence * 100).toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              {llmSignals.signals.competitors && llmSignals.signals.competitors.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600 font-medium">Competitors Identified</div>
                  <div className="text-lg font-bold text-gray-900">{llmSignals.signals.competitors.length}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:w-[35%] space-y-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Recommendations</h4>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                Improve brand online presence and documentation
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                Ensure consistent brand information across platforms
              </li>
              <li className="flex items-start">
                <span className="text-purple-500 mr-2">•</span>
                Increase brand mentions in authoritative sources
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const marketData = llmSignals?.signals?.market_comparison_combined || llmMetrics?.market_comparison || [];
  const hasRealData = marketData.length > 0;

  const mainBrandData =
    marketData.find(item => item.entity === audit_metadata.brand) || {
      sov: 0,
      cluster_coverage: 0
    };

  const mainBrandSOV = mainBrandData.sov || 0;

  const competitors = marketData.filter(
    item => item.entity !== audit_metadata.brand
  );

  const topCompetitor =
    competitors.length > 0
      ? competitors.reduce((top, comp) =>
          comp.citations > top.citations ? comp : top
        )
      : { entity: 'N/A', citations: 0 };

  const avgSOV =
    competitors.length > 0
      ? competitors.reduce((sum, comp) => sum + comp.sov, 0) /
        competitors.length
      : 0;

  const avgCitations =
    competitors.length > 0
      ? competitors.reduce((sum, comp) => sum + comp.citations, 0) /
        competitors.length
      : 0;

  // -----------------------------
  // EMPTY STATE
  // -----------------------------
  if (!hasRealData) {
    return (
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-[65%] bg-white rounded-lg shadow border overflow-hidden">
          <div className="p-6 flex flex-col items-center justify-center h-64 text-gray-500">
            <ChartBarIcon className="h-12 w-12 mb-4 text-gray-400" />
            Citation comparison not available — no citation analysis data found.
          </div>
        </div>

        <div className="lg:w-[35%] space-y-6">
          <div className="bg-white rounded-lg shadow border p-6 text-center text-gray-500">
            Cluster analysis not available — no citation analysis data found.
          </div>
          <div className="bg-white rounded-lg shadow border p-6 text-center text-gray-500">
            Competitive position not available — no citation analysis data found.
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------
  // MAIN UI
  // -----------------------------
  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* LEFT (65%) */}
      <div className="lg:w-[65%] bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900">
            Market Comparison
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            Brand vs competitors SOV comparison
          </p>
        </div>

        <div className="p-6">
          <div className="flex items-end justify-center space-x-1 h-64 overflow-x-auto pb-4">

            {/* BRAND */}
            <div className="flex flex-col items-center flex-1 min-w-0 mx-1">
              {/* FIXED HEIGHT BAR AREA */}
              <div className="flex flex-col items-center justify-end h-48 w-full">
                <div className={`text-xs font-bold mb-1 ${hasLLMData ? 'text-gray-700' : 'text-red-500'}`}>
                  {hasLLMData ? `${mainBrandSOV.toFixed(1)}%` : '--'}
                </div>
                {hasLLMData && (
                  <div
                    className="w-full bg-purple-500 rounded-t-lg max-w-16"
                    style={{ height: `${Math.min(mainBrandSOV * 3, 200)}px` }}
                  />
                )}
                {!hasLLMData && (
                  <div className="w-full bg-gray-300 rounded-t-lg max-w-16 h-4"></div>
                )}
              </div>
              {/* LABEL (independent — won't push bar) */}
              <div className="mt-2 text-xs text-center font-medium text-gray-700 max-w-16 leading-tight break-words">
                {audit_metadata.brand}
              </div>
            </div>

            {/* COMPETITORS */}
            {competitors.slice(0, 10).map((competitor, index) => (
              <div key={index} className="flex flex-col items-center flex-1 min-w-0 mx-1">
                {/* FIXED HEIGHT BAR AREA */}
                <div className="flex flex-col items-center justify-end h-48 w-full">
                  <div className="text-xs font-bold text-gray-700 mb-1">
                    {competitor.sov.toFixed(1)}%
                  </div>
                  <div
                    className="w-full bg-gray-400 rounded-t-lg max-w-16"
                    style={{
                      height: `${Math.min(competitor.sov * 3, 200)}px`
                    }}
                  />
                </div>
                {/* LABEL (independent — won't push bar) */}
                <div className="mt-2 text-xs text-center font-medium text-gray-600 max-w-16 leading-tight break-words">
                  {competitor.entity}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT (35%) */}
      <div className="lg:w-[35%] space-y-6">

        {/* MARKET SHARE */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-lg font-semibold">Prompt's Cluster Coverage</h4>
            <p className="text-sm text-gray-600 mt-1">Brand's content cluster coverage distribution</p>
          </div>

          <div className="p-6">
            <div className="flex justify-center">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full bg-gray-200"></div>

                <div
                  className="absolute inset-0 rounded-full bg-purple-500"
                  style={{
                    background: `conic-gradient(
                      rgb(168 85 247) ${(mainBrandData.cluster_coverage ?? 0) * 3.6}deg,
                      rgb(156 163 175) ${(mainBrandData.cluster_coverage ?? 0) * 3.6}deg
                    )`
                  }}
                />

                <div className="absolute inset-3 rounded-full bg-white flex items-center justify-center">
                  <div className="text-center">
                    <div className={`text-lg font-bold ${hasLLMData ? '' : 'text-red-500'}`}>
                      {hasLLMData ? `${(mainBrandData.cluster_coverage ?? 0).toFixed(1)}%` : '--'}
                    </div>
                    <div className="text-xs text-gray-600">Coverage</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* COMPETITIVE POSITION */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-lg font-semibold">Brand Citations</h4>
            <p className="text-sm text-gray-600 mt-1">Brand citation count comparison</p>
          </div>

          <div className="p-6 space-y-4">

            <div className="flex items-center">
              <div className="w-20 text-xs truncate">
                {topCompetitor.entity}
              </div>
              <div className="flex-1 mx-2 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-yellow-500 h-3 rounded-full"
                  style={{ width: `${Math.min((topCompetitor.citations || 0) / Math.max(...competitors.map(c => c.citations || 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs w-10 text-right">
                {hasLLMData ? (topCompetitor.citations || 0) : '--'}
              </div>
            </div>

            <div className="flex items-center">
              <div className="w-20 text-xs truncate">
                {audit_metadata.brand}
              </div>
              <div className="flex-1 mx-2 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-purple-500 h-3 rounded-full"
                  style={{ width: `${Math.min((mainBrandData.citations || 0) / Math.max(...competitors.map(c => c.citations || 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs w-10 text-right">
                {hasLLMData ? (mainBrandData.citations || 0) : '--'}
              </div>
            </div>

            <div className="flex items-center">
              <div className="w-20 text-xs">Average</div>
              <div className="flex-1 mx-2 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gray-400 h-3 rounded-full"
                  style={{ width: `${Math.min(avgCitations / Math.max(...competitors.map(c => c.citations || 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs w-10 text-right">
                {hasLLMData ? avgCitations.toFixed(0) : '--'}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfessionalCharts;