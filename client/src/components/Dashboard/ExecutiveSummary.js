import React from 'react';
import {
  CalendarIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  TagIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const ExecutiveSummary = ({ audit_metadata, total_checks, categories_count, critical_issues, llmMetrics }) => {
  // Use real LLM metrics if available, otherwise use fallback values
  const getLLMMetrics = () => {
    if (llmMetrics && llmMetrics.brandSOV !== undefined) {
      return {
        brandSOV: llmMetrics.brandSOV,
        brandCitations: llmMetrics.brandCitations || 0,
        clusterCoverage: llmMetrics.clusterCoverage || 0
      };
    }
    
    // Fallback values if no LLM data available
    return {
      brandSOV: 0,
      brandCitations: 0,
      clusterCoverage: 0
    };
  };

  const metrics = getLLMMetrics();
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const getHealthStatus = (score) => {
    if (score >= 90) return { status: 'Excellent', color: 'text-green-600 bg-green-100' };
    if (score >= 75) return { status: 'Good', color: 'text-blue-600 bg-blue-100' };
    if (score >= 60) return { status: 'Fair', color: 'text-yellow-600 bg-yellow-100' };
    return { status: 'Poor', color: 'text-red-600 bg-red-100' };
  };

  const healthStatus = getHealthStatus(audit_metadata.score_percentage);

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
              <div className="flex items-start">
                <TagIcon className="h-5 w-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Industry</p>
                  <p className="text-sm text-gray-600">{audit_metadata.industry}</p>
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
                  <p className="text-sm text-gray-600">{categories_count} categories analyzed</p>
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
                  <div className="text-2xl font-bold text-gray-900">
                    {metrics.brandSOV.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Brand Citations</p>
                <p className="text-sm text-gray-600">{metrics.brandCitations} citations found</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Cluster Coverage</p>
                <p className="text-sm text-gray-600">{metrics.clusterCoverage.toFixed(1)}% coverage</p>
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
