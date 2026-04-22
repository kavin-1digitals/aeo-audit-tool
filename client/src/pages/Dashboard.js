import React from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ChartBarIcon,
  DocumentTextIcon,
  EyeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import SignalTypeChart from '../components/Dashboard/SignalTypeChart';
import ExecutiveSummary from '../components/Dashboard/ExecutiveSummary';
import ProfessionalCharts from '../components/Dashboard/ProfessionalCharts';
import ScorecardsSection from '../components/Dashboard/ScorecardsSection';
import LLMAnalysisSection from '../components/Dashboard/LLMAnalysisSection';
import QuickRemediationsSection from '../components/Dashboard/QuickRemediationsSection';
import PDFReportGenerator from '../components/Dashboard/PDFReportGenerator';
import DomainPanels from '../components/Dashboard/DomainPanels';
import TopIssues from '../components/Dashboard/TopIssues';
import CompetitorComparison from '../components/Dashboard/CompetitorComparison';
import AuditHistory from '../components/Dashboard/AuditHistory';
import { Summary } from '../components/Summary';
import { ScoreOverview } from '../components/ScoreOverview';

const Dashboard = ({ auditData, onViewDetails, onNewAudit }) => {
  const { audit_metadata, path_scorecard, summary } = auditData;

  // Group scores by main category
  const getCategoryData = () => {
    const categories = {};
    
    Object.entries(path_scorecard).forEach(([pathKey, data]) => {
      const mainCategory = pathKey.split(' -> ')[0];
      
      if (!categories[mainCategory]) {
        categories[mainCategory] = {
          scores: [],
          totalScore: 0,
          totalChecks: 0,
          totalPercentage: 0
        };
      }
      
      // Accumulate scores from all paths in this category
      if (data.scores) {
        categories[mainCategory].scores.push(...data.scores);
      }
      
      // Add to totals
      categories[mainCategory].totalScore += (data.total_score || 0);
      categories[mainCategory].totalChecks += (data.total_checks || 0);
    });

    return categories;
  };

  // Get LLM signals data - return the full wrapper for LLMAnalysisSection
  const getLLMSignals = () => {
    const llmSignals = auditData.signals?.llm_signals;
    console.log('getLLMSignals - raw llm_signals:', llmSignals);
    // Return the full wrapper (LlmSignals object) for components that need it
    return llmSignals || null;
  };

  // Get LLM brand analysis metrics
  const getLLMMetrics = () => {
    // Check if LLM signals data exists in signals object
    const llmSignals = getLLMSignals();
    
    if (!llmSignals || !llmSignals.signals) {
      console.log('No LLM signals found in auditData.signals');
      return null;
    }

    const llmSignalData = llmSignals.signals; // Access the nested LlmSignal data
    
    // Use new market_comparison structure
    if (llmSignalData.market_comparison_combined && llmSignalData.market_comparison_combined.length > 0) {
      const mainBrandData = llmSignalData.market_comparison_combined.find(item => item.entity === audit_metadata.brand);
      const allCompetitors = llmSignalData.market_comparison_combined.filter(item => item.entity !== audit_metadata.brand);
      
      console.log('LLM Market Comparison Data:', llmSignalData.market_comparison_combined);
      console.log('Main Brand SOV:', mainBrandData?.sov || 0);
      
      return {
        brandSOV: mainBrandData?.sov || 0,
        brandCitations: mainBrandData?.citations || 0,
        clusterCoverage: mainBrandData?.cluster_coverage || 0,
        competitors: allCompetitors.map(item => item.entity),
        competitorSOV: allCompetitors.reduce((acc, item) => {
          acc[item.entity] = item.sov;
          return acc;
        }, {}),
        competitorCount: allCompetitors.length,
        market_comparison: llmSignalData.market_comparison_combined,
        citation_prompt_answers: llmSignalData.citation_prompt_answers // ✅ FIXED: Direct array access (no .root needed)
      };
    }
    
    // Fallback to old method if new structure not available
    const llmCategory = path_scorecard['LLM Brand Analysis'];
    if (!llmCategory) {
      console.log('No LLM Brand Analysis category found');
      return null;
    }
    
    const llmScores = llmCategory.scores || [];
    console.log('LLM Scores found:', llmScores.length);
    console.log('Sample LLM scores:', llmScores.slice(0, 3));
    
    const brandCitations = llmScores.filter(s => s.signal_name === 'brand_citation');
    const clusterCoverage = llmScores.filter(s => s.signal_name === 'cluster_coverage');
    const competitiveGaps = llmScores.filter(s => s.signal_name === 'competitive_gap');
    
    console.log('Brand citations:', brandCitations.length);
    console.log('Cluster coverage:', clusterCoverage.length);
    console.log('Competitive gaps:', competitiveGaps.length);
    
    // Calculate metrics
    const totalCitations = brandCitations.filter(s => s.value > 0).length;
    const totalPrompts = brandCitations.length;
    const citationRate = totalPrompts > 0 ? (totalCitations / totalPrompts) * 100 : 0;
    
    // Extract SOV and competitor data from success states
    let brandSOV = 0;
    let competitors = [];
    
    // Try to extract SOV from any score that mentions percentage
    llmScores.forEach(score => {
      if (score.success_state && score.success_state.includes('%')) {
        const match = score.success_state.match(/(\d+\.?\d*)%/);
        if (match) {
          const sov = parseFloat(match[1]);
          if (sov > brandSOV) brandSOV = sov;
        }
      }
    });
    
    // Count unique competitors from competitive gaps
    competitiveGaps.forEach(score => {
      if (score.remediation_plan && score.remediation_plan.includes('Competitors mentioned:')) {
        const competitorsText = score.remediation_plan.split('Competitors mentioned:')[1].split('but')[0];
        const mentionedCompetitors = competitorsText.split(',').map(c => c.trim()).filter(c => c);
        competitors.push(...mentionedCompetitors);
      }
    });
    
    const uniqueCompetitors = [...new Set(competitors)];
    
    const metrics = {
      totalCitations,
      totalPrompts,
      citationRate,
      brandSOV,
      competitorCount: uniqueCompetitors.length,
      competitors: uniqueCompetitors,
      clusterCoverageRate: clusterCoverage.length > 0 ? (clusterCoverage.filter(s => s.value > 0).length / clusterCoverage.length) * 100 : 0
    };
    
    console.log('LLM Metrics calculated:', metrics);
    return metrics;
  };

  // Get signal details for each category and group by dimension
  const getGroupedSignalDetails = (scores) => {
    const grouped = {};
    
    scores.forEach(score => {
      const dimension = formatSignalName(score.signal_name);
      
      if (!grouped[dimension]) {
        grouped[dimension] = {
          dimension,
          positiveScore: 0,
          negativeScore: 0,
          totalScore: 0,
          details: [],
          status: 'neutral',
          checkCount: 0,
          individualScores: [],
          passedCount: 0,
          failedCount: 0
        };
      }
      
      // Add score to appropriate bucket
      if (score.value > 0) {
        grouped[dimension].positiveScore += score.value;
        grouped[dimension].passedCount += 1;
      } else if (score.value < 0) {
        grouped[dimension].negativeScore += Math.abs(score.value);
        grouped[dimension].failedCount += 1;
      }
      
      grouped[dimension].totalScore += score.value;
      grouped[dimension].checkCount += 1;
      grouped[dimension].individualScores.push(score.value);
      
      // Add details
      if (score.success_state || score.remediation_plan) {
        grouped[dimension].details.push({
          type: score.value > 0 ? 'success' : score.value < 0 ? 'error' : 'warning',
          message: score.success_state || score.remediation_plan
        });
      }
    });
    
    // Determine overall status for each dimension
    Object.keys(grouped).forEach(key => {
      const item = grouped[key];
      if (item.positiveScore > item.negativeScore) {
        item.status = 'healthy';
      } else if (item.negativeScore > item.positiveScore) {
        item.status = 'critical';
      } else {
        item.status = 'needs work';
      }
      
      // Calculate percentage score: positive_score / dimension_total_checks * 100
      const dimensionTotalChecks = item.checkCount;
      item.percentageScore = dimensionTotalChecks > 0 ? (item.positiveScore / dimensionTotalChecks) * 100 : 0;
    });
    
    return Object.values(grouped);
  };

  // Format signal names to readable format
  const formatSignalName = (signalName) => {
    const nameMap = {
      'llm_txt_exists': 'LLM.txt File',
      'robots_txt_exists': 'Robots.txt File',
      'sitemap_exists': 'Sitemap File',
      'sitemap_type_valid': 'Sitemap Type',
      'category_url_count': 'Category URLs',
      'product_url_count': 'Product URLs',
      'brand_citation': 'Brand Citations',
      'cluster_coverage': 'Cluster Coverage',
      'competitive_gap': 'Competitive Gaps'
    };
    return nameMap[signalName] || signalName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const categories = getCategoryData();
  const llmMetrics = getLLMMetrics();
  const llmSignals = getLLMSignals();
  const llmSignalsWrapper = auditData.signals?.llm_signals; // Keep the wrapper for status checks
  
  console.log('=== Dashboard LLM Data Debug ===');
  console.log('auditData.signals?.llm_signals:', auditData.signals?.llm_signals);
  console.log('llmSignals (from getLLMSignals):', llmSignals);
  console.log('llmMetrics:', llmMetrics);
  console.log('audit_metadata:', audit_metadata);
  console.log('=== End Dashboard Debug ===');

  // Calculate critical issues (failed scores with negative values)
  const criticalIssues = Object.values(path_scorecard)
    .flatMap(data => data.scores || [])
    .filter(score => score.value < 0).length;

  const getScoreColor = (percentage) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 75) return 'text-blue-600 bg-blue-100';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreIcon = (percentage) => {
    if (percentage >= 90) return CheckCircleIcon;
    if (percentage >= 75) return CheckCircleIcon;
    if (percentage >= 60) return ExclamationTriangleIcon;
    return XCircleIcon;
  };

  // Calculate metrics for a category
  const calculateCategoryMetrics = (categoryName, scores) => {
    const totalChecks = scores.length;
    const passedChecks = scores.filter(score => score.value > 0).length;
    const failedChecks = scores.filter(score => score.value < 0).length;
    const percentage = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

    return {
      totalChecks,
      passedChecks,
      failedChecks,
      percentage: percentage.toFixed(1),
      signalDetails: getGroupedSignalDetails(scores)
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          AEO Audit Dashboard
        </h1>
        <p className="text-gray-600">
          {audit_metadata.domain} - {audit_metadata.brand} ({audit_metadata.location})
        </p>
      </div>

      {/* Scorecards Section */}
      {llmSignals && (
        <ScorecardsSection 
          auditData={auditData}
          llmMetrics={llmMetrics}
          llmSignals={llmSignals}
          audit_metadata={audit_metadata}
        />
      )}


      {/* Performance Overview */}
      <div id="performance-overview">
        <ScoreOverview scorecard={{
          total_score: audit_metadata.total_score || 0,
          total_checks: audit_metadata.total_checks || 1,
          total_percentage: audit_metadata.score_percentage || 0,
          percentage: audit_metadata.percentage || 0
        }} />
      </div>

      {/* Executive Summary */}
      <div id="executive-summary">
        <ExecutiveSummary 
          audit_metadata={audit_metadata}
          total_checks={audit_metadata.total_checks}
          categories_count={Object.keys(categories).length}
          critical_issues={criticalIssues}
          llmMetrics={llmMetrics}
          llmSignals={llmSignals}
          auditData={auditData}
        />
      </div>

      {/* Brand vs Competitors Chart */}
      {llmSignals && (
        <div id="professional-charts">
          <ProfessionalCharts 
            llmMetrics={llmMetrics}
            audit_metadata={audit_metadata}
            llmSignals={llmSignals}
            auditData={auditData}
          />
        </div>
      )}

      {/* Competitor Comparison */}
      {llmSignals && llmMetrics?.market_comparison && (
        <div id="competitor-comparison">
          <CompetitorComparison
            llmMetrics={llmMetrics}
            audit_metadata={audit_metadata}
          />
        </div>
      )}

      {/* LLM Signal Analysis */}
      {llmSignals && (
        <div id="llm-analysis">
          <LLMAnalysisSection
            llmSignals={llmSignals}
            audit_metadata={audit_metadata}
          />
        </div>
      )}

      {/* Signal Type Performance Chart */}
      <div id="signal-type-chart">
        <SignalTypeChart categories={categories} />
      </div>

      {/* Signal Category Panels */}
      <div id="domain-panels">
        <DomainPanels 
          categories={categories}
          calculateCategoryMetrics={calculateCategoryMetrics}
          onViewDetails={onViewDetails}
          problemCard={auditData.problemcard}
        />
      </div>

      {/* Quick Remediations Section */}
      {auditData?.quick_remediations && (
        <div id="quick-remediations">
          <QuickRemediationsSection 
            quickRemediations={auditData.quick_remediations}
          />
        </div>
      )}

      {/* Top Issues */}
      <div id="top-issues">
        <TopIssues categories={categories} pathScorecard={path_scorecard} />
      </div>

      {/* Audit History & Trends */}
      <div id="audit-history">
        <AuditHistory currentAuditData={auditData} />
      </div>

      {/* Summary Section */}
      <div id="summary-section">
        <Summary summary={summary} />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4 mb-8">
        <button
          onClick={onNewAudit}
          className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ArrowPathIcon className="h-5 w-5" />
          <span>New Audit</span>
        </button>
        
        <button
          onClick={() => onViewDetails('all')}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ChartBarIcon className="h-5 w-5" />
          <span>View Detailed Report</span>
        </button>
      </div>

      {/* PDF Report Generator */}
      <PDFReportGenerator 
        auditData={auditData}
        onGeneratePDF={(fileName) => {
          console.log('PDF generated:', fileName);
          // You could add a success notification here
        }}
      />
    </div>
  );
};

export default Dashboard;