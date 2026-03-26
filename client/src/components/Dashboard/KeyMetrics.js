import React from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const CircularProgress = ({ percentage, size = 80, strokeWidth = 8 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  
  const getColorClass = (percentage) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-blue-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getColor = (percentage) => {
    if (percentage >= 90) return '#10b981'; // green-500
    if (percentage >= 75) return '#3b82f6'; // blue-500
    if (percentage >= 60) return '#eab308'; // yellow-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="relative">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(percentage)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-bold ${getColorClass(percentage)}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

const KeyMetrics = ({ audit_metadata, criticalIssues, getScoreColor, getScoreIcon }) => {
  const totalPassed = audit_metadata.total_score || 0;
  const totalFailed = audit_metadata.total_checks - totalPassed;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Overall Score</p>
            <p className="text-sm text-gray-500 mt-1">Performance Rating</p>
          </div>
          <CircularProgress percentage={audit_metadata.score_percentage} />
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
            <p className="text-sm font-medium text-gray-600">Total Passed Cases</p>
            <p className="text-2xl font-bold text-gray-900">{totalPassed}</p>
            <p className="text-xs text-gray-500 mt-1">
              of {audit_metadata.total_checks} checks
            </p>
          </div>
          <div className={`p-3 rounded-full ${getScoreColor(audit_metadata.score_percentage)}`}>
            <CheckCircleIcon className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Critical Issues</p>
            <p className="text-2xl font-bold text-gray-900">{criticalIssues}</p>
            <p className="text-xs text-gray-500 mt-1">
              {totalFailed} failed checks
            </p>
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
