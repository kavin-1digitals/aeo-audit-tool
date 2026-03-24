import React from 'react';
import {
  MegaphoneIcon,
  ChartPieIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';

const BrandMetrics = ({ llmMetrics, getScoreColor }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Brand Citations</p>
            <p className="text-2xl font-bold text-gray-900">{llmMetrics ? `${llmMetrics.totalCitations}/${llmMetrics.totalPrompts}` : '13/14'}</p>
            <p className="text-xs text-gray-500 mt-1">{llmMetrics ? `${llmMetrics.citationRate.toFixed(1)}%` : '92.9%'} citation rate</p>
          </div>
          <div className="p-3 bg-purple-100 rounded-full">
            <MegaphoneIcon className="h-6 w-6 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Share of Voice</p>
            <p className="text-2xl font-bold text-gray-900">{llmMetrics ? `${llmMetrics.brandSOV.toFixed(1)}%` : '16.3%'}</p>
            <p className="text-xs text-gray-500 mt-1">Market presence</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-full">
            <ChartPieIcon className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Competitors</p>
            <p className="text-2xl font-bold text-gray-900">{llmMetrics ? llmMetrics.competitorCount : '8'}</p>
            <p className="text-xs text-gray-500 mt-1">Identified competitors</p>
          </div>
          <div className="p-3 bg-orange-100 rounded-full">
            <UserGroupIcon className="h-6 w-6 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Cluster Coverage</p>
            <p className="text-2xl font-bold text-gray-900">{llmMetrics ? `${llmMetrics.clusterCoverageRate.toFixed(1)}%` : '28.6%'}</p>
            <p className="text-xs text-gray-500 mt-1">Content clusters covered</p>
          </div>
          <div className={`p-3 rounded-full ${getScoreColor(llmMetrics ? llmMetrics.clusterCoverageRate : 28.6)}`}>
            <ArrowTrendingUpIcon className="h-6 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandMetrics;
