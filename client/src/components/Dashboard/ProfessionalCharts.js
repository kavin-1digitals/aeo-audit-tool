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
              {llmSignals.low_confidence_reasoning}
            </p>
            
            <div className="bg-white rounded-lg p-4 border border-amber-200 text-left max-w-sm mx-auto">
              <div className="flex items-start space-x-2">
                <InformationCircleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">What this means:</p>
                  <ul className="text-xs text-amber-700 space-y-1">
                    <li>• Insufficient brand data for competitive analysis</li>
                    <li>• AI models have limited awareness of brand</li>
                    <li>• Market share calculations cannot be performed</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:w-[35%] space-y-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Analysis Details</h4>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600 font-medium">Confidence Score</div>
                <div className="text-lg font-bold text-gray-900">
                  {llmSignals.brand_analysis ? `${(llmSignals.brand_analysis.brand_confidence * 100).toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              {llmSignals.brand_analysis?.domain && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600 font-medium">Domain</div>
                  <div className="text-sm font-medium text-gray-900">{llmSignals.brand_analysis.domain}</div>
                </div>
              )}
              {llmSignals.competitors && llmSignals.competitors.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600 font-medium">Competitors Identified</div>
                  <div className="text-lg font-bold text-gray-900">{llmSignals.competitors.length}</div>
                </div>
              )}
            </div>
          </div>
          
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

  const marketData = llmMetrics?.market_comparison || [];
  const hasRealData = marketData.length > 0;

  const mainBrandData =
    marketData.find(item => item.brand === audit_metadata.brand) || {
      brand_sov: 0,
      cluster_coverage: 0
    };

  const mainBrandSOV = mainBrandData.brand_sov || 0;

  const competitors = marketData.filter(
    item => item.brand !== audit_metadata.brand
  );

  const topCompetitor =
    competitors.length > 0
      ? competitors.reduce((top, comp) =>
          comp.brand_citations > top.brand_citations ? comp : top
        )
      : { brand: 'N/A', brand_citations: 0 };

  const avgSOV =
    competitors.length > 0
      ? competitors.reduce((sum, comp) => sum + comp.brand_sov, 0) /
        competitors.length
      : 0;

  const avgCitations =
    competitors.length > 0
      ? competitors.reduce((sum, comp) => sum + comp.brand_citations, 0) /
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
            No competitive analysis data available yet.
          </div>
        </div>

        <div className="lg:w-[35%] space-y-6">
          <div className="bg-white rounded-lg shadow border p-6 text-center text-gray-500">
            Market share coming soon
          </div>
          <div className="bg-white rounded-lg shadow border p-6 text-center text-gray-500">
            Competitive position coming soon
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
                <div className="text-xs font-bold text-gray-700 mb-1">
                  {mainBrandSOV.toFixed(1)}%
                </div>
                <div
                  className="w-full bg-purple-500 rounded-t-lg max-w-16"
                  style={{ height: `${Math.min(mainBrandSOV * 3, 200)}px` }}
                />
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
                    {competitor.brand_sov.toFixed(1)}%
                  </div>
                  <div
                    className="w-full bg-gray-400 rounded-t-lg max-w-16"
                    style={{
                      height: `${Math.min(competitor.brand_sov * 3, 200)}px`
                    }}
                  />
                </div>
                {/* LABEL (independent — won't push bar) */}
                <div className="mt-2 text-xs text-center font-medium text-gray-600 max-w-16 leading-tight break-words">
                  {competitor.brand}
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
                    <div className="text-lg font-bold">
                      {(mainBrandData.cluster_coverage ?? 0).toFixed(1)}%
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
                {topCompetitor.brand}
              </div>
              <div className="flex-1 mx-2 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-yellow-500 h-3 rounded-full"
                  style={{ width: `${Math.min((topCompetitor.brand_citations || 0) / Math.max(...competitors.map(c => c.brand_citations || 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs w-10 text-right">
                {topCompetitor.brand_citations || 0}
              </div>
            </div>

            <div className="flex items-center">
              <div className="w-20 text-xs truncate">
                {audit_metadata.brand}
              </div>
              <div className="flex-1 mx-2 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-purple-500 h-3 rounded-full"
                  style={{ width: `${Math.min((mainBrandData.brand_citations || 0) / Math.max(...competitors.map(c => c.brand_citations || 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs w-10 text-right">
                {mainBrandData.brand_citations || 0}
              </div>
            </div>

            <div className="flex items-center">
              <div className="w-20 text-xs">Average</div>
              <div className="flex-1 mx-2 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gray-400 h-3 rounded-full"
                  style={{ width: `${Math.min(avgCitations / Math.max(...competitors.map(c => c.brand_citations || 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs w-10 text-right">
                {avgCitations.toFixed(0)}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfessionalCharts;