import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudit } from '../contexts/AuditContext';
import { 
  ArrowRightIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

export const RecentRuns = () => {
  const navigate = useNavigate();
  const { runs, clearRuns, loadRecentRuns } = useAudit();

  // Load recent runs when component mounts
  useEffect(() => {
    loadRecentRuns();
  }, [loadRecentRuns]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'running':
      case 'pending':
      case 'initiating':
        return <ClockIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'completed':
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'running':
      case 'pending':
      case 'initiating':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Recent Audit Runs</h1>
        {runs.length > 0 && (
          <button
            onClick={clearRuns}
            className="flex items-center text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            Clear All
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {runs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ClockIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No recent runs found</p>
            <p className="text-sm">Start a new audit from the home page.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {runs.map((run, index) => (
              <div 
                key={run.task_id} 
                className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer"
                onClick={() => {
                  if (run.status === 'completed' || run.status === 'success') {
                    navigate(`/results/${run.task_id}`);
                  }
                }}
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                    {runs.length - index}
                  </div>
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {getStatusIcon(run.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {run.domain}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(run.status)}`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                      <span>{new Date(run.timestamp).toLocaleString()}</span>
                      <span>•</span>
                      <span className="font-mono">{run.task_id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 ml-4">
                  {(run.status === 'completed' || run.status === 'success') ? (
                    <div className="flex items-center text-blue-600 font-medium text-sm">
                      View Report
                      <ArrowRightIcon className="h-4 w-4 ml-1" />
                    </div>
                  ) : run.status === 'failed' ? (
                    <div className="text-red-500 text-xs font-medium">
                      Failed: {run.error}
                    </div>
                  ) : (
                    <div className="text-blue-500 text-xs font-medium">
                      Processing...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800 italic">
          <strong>Note:</strong> Recent runs are saved to a JSON file and will persist across server restarts.
        </p>
      </div>
    </div>
  );
};
