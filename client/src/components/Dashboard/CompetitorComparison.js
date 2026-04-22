import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { TrophyIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const BRAND_COLOR = '#3B82F6';
const COMPETITOR_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];

const CompetitorComparison = ({ llmMetrics, audit_metadata }) => {
  if (!llmMetrics || !llmMetrics.market_comparison || llmMetrics.market_comparison.length === 0) {
    return null;
  }

  const brand = audit_metadata?.brand || 'Your Brand';
  const data = llmMetrics.market_comparison;

  // SOV chart data
  const sovData = data.map((item, i) => ({
    name: item.entity.length > 18 ? item.entity.slice(0, 16) + '…' : item.entity,
    fullName: item.entity,
    sov: parseFloat((item.sov || 0).toFixed(1)),
    citations: item.citations || 0,
    cluster_coverage: parseFloat((item.cluster_coverage || 0).toFixed(1)),
    isBrand: item.entity === brand,
    color: item.entity === brand ? BRAND_COLOR : COMPETITOR_COLORS[i % COMPETITOR_COLORS.length]
  }));

  // Sort by SOV descending
  sovData.sort((a, b) => b.sov - a.sov);

  const brandData = sovData.find(d => d.isBrand);
  const brandRank = sovData.findIndex(d => d.isBrand) + 1;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const d = sovData.find(x => x.name === label);
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
          <p className="font-semibold text-gray-900 mb-1">{d?.fullName || label}</p>
          {payload.map(p => (
            <p key={p.dataKey} style={{ color: p.color }}>
              {p.name}: <span className="font-bold">{p.value}{p.dataKey === 'sov' ? '%' : p.dataKey === 'cluster_coverage' ? '%' : ''}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-50 p-2 rounded-lg">
            <ChartBarIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Competitor Comparison</h3>
            <p className="text-sm text-gray-500">AI citation share across {data.length} brands</p>
          </div>
        </div>
        {brandData && (
          <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg">
            <TrophyIcon className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">
              Rank #{brandRank} of {data.length}
            </span>
          </div>
        )}
      </div>

      {/* Share of Voice Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Share of Voice (%)</h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={sovData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="sov" name="SOV" radius={[4, 4, 0, 0]}>
              {sovData.map((entry, index) => (
                <Cell key={index} fill={entry.color} opacity={entry.isBrand ? 1 : 0.75} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed comparison table */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Full Breakdown</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-4 text-gray-500 font-medium">Brand</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">SOV</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Citations</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Cluster Coverage</th>
              </tr>
            </thead>
            <tbody>
              {sovData.map((item, i) => (
                <tr
                  key={i}
                  className={`border-b border-gray-50 ${item.isBrand ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="py-2 pr-4">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className={`font-medium ${item.isBrand ? 'text-blue-700' : 'text-gray-800'}`}>
                        {item.fullName}
                        {item.isBrand && (
                          <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold">YOU</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-3">
                    <span className={`font-bold ${item.isBrand ? 'text-blue-700' : 'text-gray-700'}`}>
                      {item.sov}%
                    </span>
                  </td>
                  <td className="text-right py-2 px-3 text-gray-600">{item.citations}</td>
                  <td className="text-right py-2 px-3">
                    <div className="flex items-center justify-end space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${item.cluster_coverage}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <span className="text-gray-600 w-10 text-right">{item.cluster_coverage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CompetitorComparison;
