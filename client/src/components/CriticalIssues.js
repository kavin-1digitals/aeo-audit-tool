import React from 'react';
import { ExclamationTriangleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export const CriticalIssues = ({ issues }) => {
  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'text-red-600 bg-red-50 border-red-200',
      high: 'text-orange-600 bg-orange-50 border-orange-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      low: 'text-blue-600 bg-blue-50 border-blue-200',
    };
    return colors[severity] || colors.medium;
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️',
    };
    return icons[severity] || icons.medium;
  };

  if (!issues || issues.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Critical Issues</h2>
        <div className="text-center py-8 text-gray-500">
          <ShieldCheckIcon className="h-12 w-12 mx-auto mb-3 text-green-400" />
          <p>No critical issues found!</p>
          <p className="text-sm">Your website is performing well.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Critical Issues</h2>
      
      <div className="space-y-4">
        {issues.map((issue, index) => (
          <div 
            key={index}
            className={`p-4 rounded-lg border ${getSeverityColor(issue.severity)}`}
          >
            <div className="flex items-start space-x-3">
              <div className="text-2xl">
                {getSeverityIcon(issue.severity)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`text-xs font-medium uppercase tracking-wide ${getSeverityColor(issue.severity)}`}>
                    {issue.severity || 'medium'}
                  </span>
                  <span className="text-xs text-gray-500">
                    • {issue.category || 'general'}
                  </span>
                </div>
                
                <h3 className="font-semibold text-gray-900 mb-2">
                  {issue.issue || 'No issue description available'}
                </h3>
                
                {issue.impact && (
                  <div className="text-sm">
                    <span className="text-gray-600">Impact:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {issue.impact}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-2">Immediate Action Required</h3>
            <p className="text-red-700 text-sm">
              Critical issues can significantly impact your website's performance in AI-powered search engines. 
              Address these issues promptly to improve your AEO score and visibility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
