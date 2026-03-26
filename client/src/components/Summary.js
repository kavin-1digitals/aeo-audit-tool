import React from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export const Summary = ({ summary }) => {
  if (!summary || (!summary.performance_highlights?.length && !summary.improvement_areas?.length)) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Performance Highlights */}
      {summary.performance_highlights?.length > 0 && (
        <div className="card">
          <div className="flex items-center mb-4">
            <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Performance Highlights</h2>
          </div>
          <div className="space-y-3">
            {summary.performance_highlights.map((highlight, index) => (
              <div key={index} className="flex items-start p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 text-sm leading-relaxed">{highlight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Areas */}
      {summary.improvement_areas?.length > 0 && (
        <div className="card">
          <div className="flex items-center mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Areas for Improvement</h2>
          </div>
          <div className="space-y-3">
            {summary.improvement_areas.map((area, index) => (
              <div key={index} className="flex items-start p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-gray-700 text-sm leading-relaxed">{area}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
