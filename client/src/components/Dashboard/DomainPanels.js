import React from 'react';
import {
  ChartBarIcon,
  DocumentTextIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

const DomainPanels = ({ categories, calculateCategoryMetrics, onViewDetails, problemCard }) => {
  const getCategoryIcon = (categoryName) => {
    switch (categoryName) {
      case 'Domain Signals':
        return DocumentTextIcon;
      case 'Site Signals':
        return ChartBarIcon;
      case 'LLM Brand Analysis':
        return EyeIcon;
      default:
        return DocumentTextIcon;
    }
  };

  const getProblemsForCategory = (categoryName) => {
    if (!problemCard || !problemCard.problems) return [];
    return problemCard.problems.filter(problem => 
      problem.signal_path && problem.signal_path[0] === categoryName
    );
  };

  // Get all unique categories from both scorecard and problemCard
  const getAllCategories = () => {
    const categorySet = new Set();
    
    // Add categories from scorecard
    Object.keys(categories).forEach(cat => categorySet.add(cat));
    
    // Add categories from problemCard
    if (problemCard && problemCard.problems) {
      problemCard.problems.forEach(problem => {
        if (problem.signal_path && problem.signal_path[0]) {
          categorySet.add(problem.signal_path[0]);
        }
      });
    }
    
    return Array.from(categorySet);
  };

  const allCategories = getAllCategories();

  return (
    <div className="space-y-6">
      {allCategories.map((categoryName) => {
        const categoryData = categories[categoryName];
        const metrics = categoryData ? calculateCategoryMetrics(categoryName, categoryData.scores) : { totalChecks: 0, passedChecks: 0, failedChecks: 0, signalDetails: [] };
        const IconComponent = getCategoryIcon(categoryName);
        const categoryProblems = getProblemsForCategory(categoryName);

        return (
          <div key={categoryName} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <IconComponent className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{categoryName}</h3>
                    <p className="text-sm text-gray-500">
                      {categoryData ? `${metrics.totalChecks} checks total` : 'No scorecard data available'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => onViewDetails(categoryName)}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <span>View Details</span>
                  <ChartBarIcon className="h-4 w-4" />
                </button>
              </div>

              {categoryData ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Dimension</th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Passed Cases</th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Failed Cases</th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Score (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {metrics.signalDetails.map((signal, index) => {
                        const getStatusColor = (status) => {
                          switch (status) {
                            case 'healthy': return 'text-green-600 bg-green-100';
                            case 'critical': return 'text-red-600 bg-red-100';
                            case 'needs work': return 'text-yellow-600 bg-yellow-100';
                            default: return 'text-gray-600 bg-gray-100';
                          }
                        };
                        
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center">
                                <div className="text-sm font-medium text-gray-900">{signal.dimension}</div>
                                <div className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                                  {signal.checkCount} checks
                                </div>
                              </div>
                              {signal.details.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {signal.details.slice(0, 2).map((detail, idx) => (
                                    <div key={idx} className="text-xs text-gray-500 truncate max-w-xs" title={detail.message}>
                                      {detail.message}
                                    </div>
                                  ))}
                                  {signal.details.length > 2 && (
                                    <div className="text-xs text-gray-400">
                                      +{signal.details.length - 2} more...
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="text-sm font-semibold text-green-600">
                                {signal.passedCount}/{signal.checkCount}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="text-sm font-semibold text-red-600">
                                {signal.failedCount}/{signal.checkCount}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(signal.status)}`}>
                                {signal.status.charAt(0).toUpperCase() + signal.status.slice(1)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className={`text-sm font-mono font-semibold ${
                                signal.percentageScore >= 75 ? 'text-green-600' : 
                                signal.percentageScore >= 50 ? 'text-yellow-600' : 
                                'text-red-600'
                              }`}>
                                {signal.percentageScore.toFixed(1)}%
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 text-sm">No scorecard data available for this category</div>
                </div>
              )}

              {/* Problems Table - Show only if there are problems */}
              {categoryProblems && categoryProblems.length > 0 && (
                <div className="mt-6">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">Issues Detected</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Issue</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Signals Affected</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Cause</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {categoryProblems.map((problem, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="text-sm font-bold text-black">{problem.issue_found}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-gray-600">{problem.signal_names.join(', ')}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-red-600">{problem.cause_of_issue}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Summary Row - Only show if there's scorecard data */}
              {categoryData && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-6">
                      <span className="flex items-center">
                        <div className="w-3 h-3 bg-green-100 rounded-full mr-2"></div>
                        <span className="text-gray-600">Healthy: <strong>{metrics.passedChecks}</strong></span>
                      </span>
                      <span className="flex items-center">
                        <div className="w-3 h-3 bg-red-100 rounded-full mr-2"></div>
                        <span className="text-gray-600">Critical: <strong>{metrics.failedChecks}</strong></span>
                      </span>
                      <span className="flex items-center">
                        <div className="w-3 h-3 bg-yellow-100 rounded-full mr-2"></div>
                        <span className="text-gray-600">Needs Work: <strong>{metrics.totalChecks - metrics.passedChecks - metrics.failedChecks}</strong></span>
                      </span>
                    </div>
                    <div className="text-gray-500">
                      {metrics.passedChecks}/{metrics.totalChecks} individual checks passed
                    </div>
                  </div>
                  
                  {/* Show dimension breakdown */}
                  <div className="mt-2 text-xs text-gray-500">
                    {metrics.signalDetails.length} dimensions shown ({metrics.totalChecks} total checks)
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DomainPanels;
