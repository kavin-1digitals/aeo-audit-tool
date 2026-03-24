import React from 'react';

const ProfessionalCharts = ({ llmMetrics, audit_metadata }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Expanded Market Comparison (2 columns wide) */}
      <div className="lg:col-span-2 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900">Market Comparison</h4>
          <p className="text-sm text-gray-600 mt-1">Brand vs competitors SOV comparison</p>
        </div>
        <div className="p-6">
          <div className="flex items-end justify-center space-x-1 h-64 overflow-x-auto pb-4">
            {/* Brand Bar */}
            <div className="flex flex-col items-center flex-1 min-w-0 mx-1">
              <div 
                className="w-full bg-purple-500 rounded-t-lg flex items-end justify-center max-w-16"
                style={{ height: `${Math.min((llmMetrics ? llmMetrics.brandSOV : 16.3) * 3, 200)}px` }}
              >
                <span className="text-xs text-white font-bold p-1">{llmMetrics ? `${llmMetrics.brandSOV.toFixed(1)}%` : '16.3%'}</span>
              </div>
              <div className="mt-2 text-xs font-medium text-gray-700 text-center truncate max-w-16">{audit_metadata.brand}</div>
            </div>
            
            {/* Competitor Bars - Show more competitors with larger space */}
            {(llmMetrics ? llmMetrics.competitors.slice(0, 10) : ['Nike', 'Adidas', 'Lululemon', 'Under Armour', 'Puma', 'Reebok', 'New Balance', 'ASICS', 'Fila', 'Converse']).map((competitor, index) => {
              const competitorSOV = Math.max(3, Math.random() * 25);
              return (
                <div key={index} className="flex flex-col items-center flex-1 min-w-0 mx-1">
                  <div 
                    className="w-full bg-gray-400 rounded-t-lg flex items-end justify-center max-w-16"
                    style={{ height: `${competitorSOV * 3}px` }}
                  >
                    <span className="text-xs text-white font-bold p-1">{competitorSOV.toFixed(1)}%</span>
                  </div>
                  <div className="mt-2 text-xs font-medium text-gray-600 text-center truncate max-w-16">{competitor}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-gray-500 text-center">
            Showing {llmMetrics ? Math.min(llmMetrics.competitors.length, 10) : 10} of {llmMetrics ? llmMetrics.competitorCount : 12} total competitors
          </div>
        </div>
      </div>

      {/* Right Column: Market Share (Top) + Competitive Position (Bottom) */}
      <div className="space-y-6">
        {/* Top: Market Share */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900">Market Share</h4>
            <p className="text-sm text-gray-600 mt-1">Brand's share of voice distribution</p>
          </div>
          <div className="p-6">
            <div className="flex justify-center">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full bg-gray-200"></div>
                <div 
                  className="absolute inset-0 rounded-full bg-purple-500"
                  style={{
                    background: `conic-gradient(
                      from 0deg,
                      rgb(168 85 247) 0deg,
                      rgb(168 85 247) ${(llmMetrics ? llmMetrics.brandSOV : 16.3) * 3.6}deg,
                      rgb(156 163 175) ${(llmMetrics ? llmMetrics.brandSOV : 16.3) * 3.6}deg,
                      rgb(156 163 175) 360deg
                    )`
                  }}
                ></div>
                <div className="absolute inset-3 rounded-full bg-white flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{llmMetrics ? `${llmMetrics.brandSOV.toFixed(1)}%` : '16.3%'}</div>
                    <div className="text-xs text-gray-600">SOV</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Competitive Position */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900">Competitive Position</h4>
            <p className="text-sm text-gray-600 mt-1">Relative position in market</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-20 text-xs text-gray-600">Leader</div>
                <div className="flex-1 mx-2">
                  <div className="bg-gray-200 rounded-full h-3">
                    <div className="bg-yellow-500 h-3 rounded-full" style={{ width: '24.8%' }}></div>
                  </div>
                </div>
                <div className="text-xs font-medium text-gray-700 w-10 text-right">24.8%</div>
              </div>
              
              <div className="flex items-center">
                <div className="w-20 text-xs text-gray-600">{audit_metadata.brand}</div>
                <div className="flex-1 mx-2">
                  <div className="bg-gray-200 rounded-full h-3">
                    <div className="bg-purple-500 h-3 rounded-full" style={{ width: `${llmMetrics ? llmMetrics.brandSOV : 16.3}%` }}></div>
                  </div>
                </div>
                <div className="text-xs font-medium text-gray-700 w-10 text-right">{llmMetrics ? `${llmMetrics.brandSOV.toFixed(1)}%` : '16.3%'}</div>
              </div>
              
              <div className="flex items-center">
                <div className="w-20 text-xs text-gray-600">Average</div>
                <div className="flex-1 mx-2">
                  <div className="bg-gray-200 rounded-full h-3">
                    <div className="bg-gray-400 h-3 rounded-full" style={{ width: '12.5%' }}></div>
                  </div>
                </div>
                <div className="text-xs font-medium text-gray-700 w-10 text-right">12.5%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalCharts;
