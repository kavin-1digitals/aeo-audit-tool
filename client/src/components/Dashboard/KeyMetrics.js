import React from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const KeyMetrics = ({ audit_metadata, criticalIssues, getScoreColor, getScoreIcon }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Overall Score</p>
            <p className="text-2xl font-bold text-gray-900">{audit_metadata.score_percentage.toFixed(1)}%</p>
          </div>
          <div className={`p-3 rounded-full ${getScoreColor(audit_metadata.score_percentage)}`}>
            <ChartBarIcon className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Checks</p>
            <p className="text-2xl font-bold text-gray-900">{audit_metadata.total_checks}</p>
          </div>
          <div className="p-3 bg-gray-100 rounded-full">
            {React.createElement(getScoreIcon(audit_metadata.score_percentage), { className: "h-6 w-6" })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Success Rate</p>
            <p className="text-2xl font-bold text-gray-900">{audit_metadata.score_percentage.toFixed(1)}%</p>
          </div>
          <div className={`p-3 rounded-full ${getScoreColor(audit_metadata.score_percentage)}`}>
            {React.createElement(getScoreIcon(audit_metadata.score_percentage), { className: "h-6 w-6" })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Critical Issues</p>
            <p className="text-2xl font-bold text-gray-900">{criticalIssues}</p>
          </div>
          <div className={`p-3 rounded-full ${criticalIssues > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
            <ExclamationTriangleIcon className={`h-6 w-6 ${criticalIssues > 0 ? 'text-red-600' : 'text-green-600'}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyMetrics;
