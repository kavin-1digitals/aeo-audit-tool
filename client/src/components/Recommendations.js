import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

export const Recommendations = ({ recommendations }) => {
  const getPriorityColor = (priority) => {
    const colors = {
      high: 'text-red-600 bg-red-50 border-red-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      low: 'text-blue-600 bg-blue-50 border-blue-200',
    };
    return colors[priority] || colors.low;
  };

  const getPriorityIcon = (priority) => {
    const icons = {
      high: '🔴',
      medium: '🟡',
      low: '🔵',
    };
    return icons[priority] || icons.low;
  };

  const getImpactColor = (impact) => {
    const colors = {
      critical: 'text-red-700 font-semibold',
      high: 'text-red-600 font-medium',
      medium: 'text-yellow-600',
      low: 'text-blue-600',
    };
    return colors[impact] || colors.medium;
  };

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recommendations</h2>
        <div className="text-center py-8 text-gray-500">
          <CheckCircleIcon className="h-12 w-12 mx-auto mb-3 text-green-400" />
          <p>No recommendations needed!</p>
          <p className="text-sm">Your website is well optimized for AEO.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Recommendations</h2>
      
      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div 
            key={index}
            className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}
          >
            <div className="flex items-start space-x-3">
              <div className="text-2xl">
                {getPriorityIcon(rec.priority)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`text-xs font-medium uppercase tracking-wide ${getPriorityColor(rec.priority)}`}>
                    {rec.priority || 'low'} Priority
                  </span>
                  <span className="text-xs text-gray-500">
                    • {rec.category || 'general'}
                  </span>
                </div>
                
                <h3 className="font-semibold text-gray-900 mb-2">
                  {rec.action || 'No action specified'}
                </h3>
                
                {rec.focus && (
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-600">Focus:</span>
                    <span className={getImpactColor(rec.impact)}>
                      {rec.focus}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Next Steps</h3>
        <p className="text-blue-700 text-sm">
          Start with high-priority recommendations to maximize your AEO performance. 
          Focus on critical issues that impact AI engine understanding and content discoverability.
        </p>
      </div>
    </div>
  );
};
