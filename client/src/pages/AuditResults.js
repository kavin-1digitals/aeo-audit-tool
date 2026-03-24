import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAudit } from '../contexts/AuditContext';
import { ScoreOverview } from '../components/ScoreOverview';
import { CategoryBreakdown } from '../components/CategoryBreakdown';
import { Recommendations } from '../components/Recommendations';
import { CriticalIssues } from '../components/CriticalIssues';
import { ArrowLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export const AuditResults = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { runs, getAuditResults, error, clearError, stopPolling, isLoading } = useAudit();
  const [isPolling, setIsPolling] = useState(false);

  const currentRun = runs.find(r => r.task_id === taskId);
  const auditResults = currentRun;

  useEffect(() => {
    if (taskId && !currentRun && !isLoading) {
      setIsPolling(true);
      getAuditResults(taskId);
    }
  }, [taskId, currentRun, getAuditResults, isLoading]);

  useEffect(() => {
    if (auditResults) {
      setIsPolling(false);
    }
  }, [auditResults]);

  // Clean up polling when component unmounts
  useEffect(() => {
    return () => {
      if (stopPolling) {
        stopPolling(taskId);
      }
    };
  }, [stopPolling, taskId]);

  const handleRetry = () => {
    clearError();
    if (taskId) {
      getAuditResults(taskId);
    }
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Home
          </button>
        </div>

        <div className="card">
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Audit Failed</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button onClick={handleRetry} className="btn-primary">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if we have a completed run with results
  const result = currentRun?.result;
  
  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Home
          </button>
        </div>

        <div className="card">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {isPolling ? 'Analyzing Website...' : 'Loading Results...'}
            </h2>
            <p className="text-gray-600">
              {isPolling 
                ? 'Please wait while we analyze your website for AEO readiness.'
                : 'Loading your audit results...'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { audit_metadata = {}, aeo_scorecard = {} } = result;
  const { domain: resultDomain, timestamp } = audit_metadata;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Home
        </button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          AEO Audit Results
        </h1>
        <div className="flex items-center space-x-4 text-gray-600">
          <span>{resultDomain || 'Unknown Domain'}</span>
          <span>•</span>
          <span>{timestamp ? new Date(timestamp).toLocaleString() : 'Date unavailable'}</span>
        </div>
      </div>

      {/* Score Overview */}
      {aeo_scorecard && <ScoreOverview scorecard={aeo_scorecard} />}

      {/* Category Breakdown */}
      {aeo_scorecard && aeo_scorecard.categories && (
        <CategoryBreakdown categories={aeo_scorecard.categories} />
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recommendations */}
        {aeo_scorecard && aeo_scorecard.recommendations && (
          <Recommendations recommendations={aeo_scorecard.recommendations} />
        )}

        {/* Critical Issues */}
        {aeo_scorecard && aeo_scorecard.critical_issues && (
          <CriticalIssues issues={aeo_scorecard.critical_issues} />
        )}
      </div>
    </div>
  );
};
