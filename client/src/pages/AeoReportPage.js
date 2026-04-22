import React, { useState, useEffect } from 'react';
import { getAuditResults } from '../services/api';
import Dashboard from './Dashboard';
import DetailedReport from './DetailedReport';
import ReportGuide from '../components/Dashboard/ReportGuide';
import FixIssues from '../components/Dashboard/FixIssues';
import ScoreSimulator from '../components/Dashboard/ScoreSimulator';
import IndustryBenchmarks from '../components/Dashboard/IndustryBenchmarks';
import PromptsLab from '../components/Dashboard/PromptsLab';
import ExportCentre from '../components/Dashboard/ExportCentre';
import CompetitorAudit from '../components/Dashboard/CompetitorAudit';
import {
  ChartBarIcon,
  DocumentMagnifyingGlassIcon,
  InformationCircleIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  BeakerIcon,
  BuildingOfficeIcon,
  ArrowsRightLeftIcon,
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', Icon: ChartBarIcon },
  { id: 'detailed', label: 'Detailed Report', Icon: DocumentMagnifyingGlassIcon },
  { id: 'fix', label: 'Fix Issues', Icon: WrenchScrewdriverIcon },
  { id: 'simulate', label: 'Simulator', Icon: BeakerIcon },
  { id: 'benchmarks', label: 'Benchmarks', Icon: BuildingOfficeIcon },
  { id: 'competitor', label: 'Competitor', Icon: ArrowsRightLeftIcon },
  { id: 'prompts', label: 'Prompts Lab', Icon: ChatBubbleLeftRightIcon },
  { id: 'export', label: 'Export', Icon: ArrowDownTrayIcon },
  { id: 'guide', label: 'Report Guide', Icon: InformationCircleIcon },
];

const AeoReportPage = ({ auditData: propAuditData, onNewAudit }) => {
  const [auditData, setAuditData] = useState(propAuditData || null);
  const [loading, setLoading] = useState(!propAuditData);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    if (!propAuditData) {
      fetchAuditData();
    }
  }, [propAuditData]);

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      const data = await getAuditResults();
      setAuditData(data);
    } catch (error) {
      console.error('AeoReportPage - Failed to fetch audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (category) => {
    setSelectedCategory(category);
    setCurrentView('detailed');
  };

  const handleNewAudit = () => {
    if (onNewAudit) {
      onNewAudit();
    } else {
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading audit results...</p>
        </div>
      </div>
    );
  }

  if (!auditData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 rounded-full p-3 mx-auto w-12 h-12 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Audit Data Available</h3>
          <p className="text-gray-500 mb-4">
            Unable to load audit results. Please try running a new audit.
          </p>
          <button
            onClick={handleNewAudit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Audit
          </button>
        </div>
      </div>
    );
  }

  const issueCount = (auditData.raw_scorecard?.scores || []).filter(s => s.value < 0 && s.remediation_plan).length;

  const tabBar = (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <nav className="flex space-x-0 overflow-x-auto" aria-label="Report tabs">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => {
                  if (id === 'detailed') setSelectedCategory('all');
                  setCurrentView(id);
                }}
                className={`flex items-center gap-1.5 px-3 py-4 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  currentView === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {id === 'fix' && issueCount > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    currentView === id ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {issueCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <button
            onClick={onNewAudit}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors py-2 px-3 rounded-lg hover:bg-blue-50 ml-2"
          >
            <ArrowPathIcon className="h-4 w-4" />
            New Audit
          </button>
        </div>
      </div>
    </div>
  );

  const views = {
    guide: <ReportGuide />,
    fix: <FixIssues auditData={auditData} />,
    simulate: <ScoreSimulator auditData={auditData} />,
    benchmarks: <IndustryBenchmarks auditData={auditData} />,
    competitor: <CompetitorAudit auditData={auditData} />,
    prompts: <PromptsLab auditData={auditData} />,
    export: <ExportCentre auditData={auditData} />,
  };

  if (views[currentView]) {
    return (
      <div className="min-h-screen bg-gray-50">
        {tabBar}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {views[currentView]}
        </div>
      </div>
    );
  }

  if (currentView === 'detailed') {
    return (
      <div className="min-h-screen bg-gray-50">
        {tabBar}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DetailedReport
            auditData={auditData}
            onBack={() => setCurrentView('dashboard')}
            selectedCategory={selectedCategory}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {tabBar}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Dashboard
          auditData={auditData}
          onViewDetails={handleViewDetails}
          onNewAudit={onNewAudit}
        />
      </div>
    </div>
  );
};

export default AeoReportPage;
