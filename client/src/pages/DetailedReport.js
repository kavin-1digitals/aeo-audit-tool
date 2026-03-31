import React, { useState, useMemo, useEffect } from 'react';
import { 
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  DocumentArrowDownIcon,
  ArrowLeftIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

const DetailedReport = ({ auditData, onBack, selectedCategory = 'all' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSignalName, setFilterSignalName] = useState('all');

  const { audit_metadata, path_scorecard } = auditData;

  // Convert signal name to UI-friendly format
  const getFriendlySignalName = (signalName) => {
    if (!signalName) return '';
    return signalName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get available categories
  const getAvailableCategories = () => {
    const categories = new Set();
    Object.keys(path_scorecard).forEach(pathKey => {
      const mainCategory = pathKey.split(' -> ')[0];
      categories.add(mainCategory);
    });
    return Array.from(categories).sort();
  };

  // Get available signal names for selected category
  const getAvailableSignalNames = (category) => {
    if (category === 'all') {
      const signalNames = new Set();
      Object.values(path_scorecard).forEach(data => {
        (data.scores || []).forEach(score => {
          signalNames.add(score.signal_name);
        });
      });
      return Array.from(signalNames).sort();
    } else {
      const signalNames = new Set();
      Object.entries(path_scorecard).forEach(([pathKey, data]) => {
        const mainCategory = pathKey.split(' -> ')[0];
        if (mainCategory === category) {
          (data.scores || []).forEach(score => {
            signalNames.add(score.signal_name);
          });
        }
      });
      return Array.from(signalNames).sort();
    }
  };

  // Get all scores and filter by category if specified
  const getAllScores = () => {
    const allScores = [];
    
    Object.entries(path_scorecard).forEach(([pathKey, data]) => {
      const mainCategory = pathKey.split(' -> ')[0];
      
      if (selectedCategory === 'all' || mainCategory === selectedCategory) {
        (data.scores || []).forEach(score => {
          allScores.push({
            ...score,
            category: mainCategory,
            subcategory: pathKey.split(' -> ')[1] || '',
            fullPath: pathKey
          });
        });
      }
    });
    
    return allScores;
  };

  // Filter and sort scores
  const filteredAndSortedScores = useMemo(() => {
    let scores = getAllScores();

    // Apply search filter
    if (searchTerm) {
      scores = scores.filter(score => {
        const friendlySignalName = getFriendlySignalName(score.signal_name);
        return (
          friendlySignalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          score.signal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          score.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          score.subcategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (score.success_state && score.success_state.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      });
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      scores = scores.filter(score => {
        if (filterStatus === 'passed') return score.value > 0;
        if (filterStatus === 'failed') return score.value < 0;
        if (filterStatus === 'neutral') return score.value === 0;
        return true;
      });
    }

    // Apply category filter
    if (filterCategory !== 'all') {
      scores = scores.filter(score => score.category === filterCategory);
    }

    // Apply signal name filter
    if (filterSignalName !== 'all') {
      scores = scores.filter(score => score.signal_name === filterSignalName);
    }

    // Apply default sorting by signal name
    scores.sort((a, b) => a.signal_name.localeCompare(b.signal_name));

    return scores;
  }, [searchTerm, filterStatus, filterCategory, filterSignalName, selectedCategory, path_scorecard, getAllScores]);

  const getStatusIcon = (value) => {
    if (value > 0) return CheckCircleIcon;
    if (value < 0) return XCircleIcon;
    return ExclamationTriangleIcon;
  };

  const getStatusColor = (value) => {
    if (value > 0) return 'text-green-600 bg-green-100';
    if (value < 0) return 'text-red-600 bg-red-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const getStatusText = (value) => {
    if (value > 0) return 'Passed';
    if (value < 0) return 'Failed';
    return 'Neutral';
  };

  const exportToCSV = () => {
    const headers = ['Category', 'Signal Name', 'Status', 'Score', 'Success State', 'Remediation Plan'];
    const rows = filteredAndSortedScores.map(score => [
      score.category,
      score.signal_name,
      getStatusText(score.value),
      score.value,
      score.success_state || '',
      score.remediation_plan || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aeo-audit-report-${audit_metadata.domain.replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Reset signal name filter when category changes
  const handleCategoryChange = (newCategory) => {
    setFilterCategory(newCategory);
    setFilterSignalName('all');
  };

  return (
    <div className="space-y-6">
      {/* Scroll to top effect */}
      {useEffect(() => {
        window.scrollTo(0, 0);
      }, [])}
      
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <button
            onClick={onBack}
            className="absolute left-4 flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedCategory === 'all' ? 'Detailed Report' : selectedCategory}
          </h1>
          
          <button
            onClick={exportToCSV}
            className="absolute right-4 flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
            <span>Export CSV</span>
          </button>
        </div>
        
        <p className="text-gray-600">
          {audit_metadata.domain} - {audit_metadata.brand}
        </p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search signals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {getAvailableCategories().map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Signal Name Filter */}
          <div>
            <select
              value={filterSignalName}
              onChange={(e) => setFilterSignalName(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Signals</option>
              {getAvailableSignalNames(filterCategory).map(signalName => (
                <option key={signalName} value={signalName}>{getFriendlySignalName(signalName)}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {filteredAndSortedScores.length} of {getAllScores().length} signals
          </span>
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <div className="w-3 h-3 bg-green-100 rounded-full mr-2"></div>
              Passed: {filteredAndSortedScores.filter(s => s.value > 0).length}
            </span>
            <span className="flex items-center">
              <div className="w-3 h-3 bg-red-100 rounded-full mr-2"></div>
              Failed: {filteredAndSortedScores.filter(s => s.value < 0).length}
            </span>
            <span className="flex items-center">
              <div className="w-3 h-3 bg-yellow-100 rounded-full mr-2"></div>
              Neutral: {filteredAndSortedScores.filter(s => s.value === 0).length}
            </span>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signal Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success State or Remediation
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedScores.map((score, index) => {
                const StatusIcon = getStatusIcon(score.value);
                const statusColor = getStatusColor(score.value);
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {score.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getFriendlySignalName(score.signal_name)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        <StatusIcon className="h-4 w-4 mr-1" />
                        {getStatusText(score.value)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {score.value > 0 ? '+' : ''}{score.value}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {score.success_state && (
                        <div className="flex items-start">
                          <InformationCircleIcon className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                          <span className="text-gray-700">{score.success_state}</span>
                        </div>
                      )}
                      {score.remediation_plan && (
                        <div className="text-orange-700 bg-orange-50 p-2 rounded border border-orange-200">
                          {score.remediation_plan}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredAndSortedScores.length === 0 && (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No signals found</h3>
            <p className="text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailedReport;
