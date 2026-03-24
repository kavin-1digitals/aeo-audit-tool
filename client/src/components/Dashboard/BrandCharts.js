import React from 'react';

const BrandCharts = ({ llmMetrics, audit_metadata }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Brand vs Competitors - Share of Voice</h3>
      
      {/* Vertical Bar Chart */}
      <div className="mb-8">
        <div className="flex items-end justify-center space-x-4 h-64">
          {/* Brand Bar */}
          <div className="flex flex-col items-center">
            <div 
              className="w-16 bg-purple-500 rounded-t-lg flex items-end justify-center"
              style={{ height: `${Math.min((llmMetrics ? llmMetrics.brandSOV : 16.3) * 3, 200)}px` }}
            >
              <span className="text-xs text-white font-bold p-1">{llmMetrics ? `${llmMetrics.brandSOV.toFixed(1)}%` : '16.3%'}</span>
            </div>
            <div className="mt-2 text-sm font-medium text-gray-700 text-center">{audit_metadata.brand}</div>
          </div>
          
          {/* Competitor Bars */}
          {(llmMetrics ? llmMetrics.competitors.slice(0, 3) : ['Nike', 'Adidas', 'Lululemon']).map((competitor, index) => {
            const competitorSOV = Math.max(5, Math.random() * 20);
            return (
              <div key={index} className="flex flex-col items-center">
                <div 
                  className="w-16 bg-gray-400 rounded-t-lg flex items-end justify-center"
                  style={{ height: `${competitorSOV * 3}px` }}
                >
                  <span className="text-xs text-white font-bold p-1">{competitorSOV.toFixed(1)}%</span>
                </div>
                <div className="mt-2 text-sm font-medium text-gray-600 text-center">{competitor}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pie Chart Representation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-md font-semibold text-gray-800 mb-3">Market Share Distribution</h4>
          <div className="relative h-40">
            <div className="w-40 h-40 mx-auto relative">
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
              <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{llmMetrics ? `${llmMetrics.brandSOV.toFixed(1)}%` : '16.3%'}</div>
                  <div className="text-xs text-gray-600">{audit_metadata.brand}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar Chart */}
        <div>
          <h4 className="text-md font-semibold text-gray-800 mb-3">Competitive Position</h4>
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="w-24 text-sm text-gray-600">Market Leader</div>
              <div className="flex-1 mx-3">
                <div className="bg-gray-200 rounded-full h-4">
                  <div className="bg-yellow-500 h-4 rounded-full" style={{ width: '24.8%' }}></div>
                </div>
              </div>
              <div className="text-sm font-medium text-gray-700 w-12 text-right">24.8%</div>
            </div>
            
            <div className="flex items-center">
              <div className="w-24 text-sm text-gray-600">{audit_metadata.brand}</div>
              <div className="flex-1 mx-3">
                <div className="bg-gray-200 rounded-full h-4">
                  <div className="bg-purple-500 h-4 rounded-full" style={{ width: `${llmMetrics ? llmMetrics.brandSOV : 16.3}%` }}></div>
                </div>
              </div>
              <div className="text-sm font-medium text-gray-700 w-12 text-right">{llmMetrics ? `${llmMetrics.brandSOV.toFixed(1)}%` : '16.3%'}</div>
            </div>
            
            <div className="flex items-center">
              <div className="w-24 text-sm text-gray-600">Avg Competitor</div>
              <div className="flex-1 mx-3">
                <div className="bg-gray-200 rounded-full h-4">
                  <div className="bg-gray-400 h-4 rounded-full" style={{ width: '12.5%' }}></div>
                </div>
              </div>
              <div className="text-sm font-medium text-gray-700 w-12 text-right">12.5%</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          {llmMetrics ? (
            <span>
              Brand ranks #{Math.max(1, Math.floor((100 - llmMetrics.brandSOV) / 15) + 1)} out of {llmMetrics.competitorCount + 1} total brands • 
              {llmMetrics.brandSOV > 20 ? ' Above average market presence' : 
               llmMetrics.brandSOV > 10 ? ' Moderate market presence' : 
               ' Room for growth in market presence'}
            </span>
          ) : (
            <span>
              Brand ranks #3 out of 9 total brands • Moderate market presence
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default BrandCharts;
