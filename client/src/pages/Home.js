import React, { useState } from 'react';
import { useAudit } from '../contexts/AuditContext';
import { ExclamationTriangleIcon, SparklesIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from '../components/LoadingSpinner';
import AeoReportPage from './AeoReportPage';

export const Home = () => {
  const { error, isLoading, clearError, startAudit } = useAudit();
  const [domain, setDomain] = useState('https://www.aloyoga.com');
  const [brand, setBrand] = useState('Alo Yoga');
  const [geo, setGeo] = useState('United States');
  const [auditData, setAuditData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!domain.trim() || !brand.trim()) {
      return;
    }

    try {
      clearError();
      console.log(`Starting AEO audit for ${domain.trim()} with brand ${brand.trim()}...`);
      
      const data = await startAudit(domain.trim(), brand.trim(), geo.trim());
      console.log('Raw API response:', data);
      
      setAuditData(data);
      console.log('Audit data set in state:', data);
    } catch (err) {
      console.error('Audit failed:', err.message);
    }
  };

  const handleNewAudit = () => {
    setAuditData(null);
    setDomain('https://www.aloyoga.com');
    setBrand('Alo Yoga');
    setGeo('United States');
    clearError();
  };

  // If we have audit data, show the report
  if (auditData) {
    console.log('Home: Rendering AeoReportPage with data:', auditData);
    return <AeoReportPage auditData={auditData} onNewAudit={handleNewAudit} />;
  }

  // Show loading state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Show the audit form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-3">
                <SparklesIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  1Digitals
                </h1>
                <p className="text-sm font-medium text-gray-600">AI AUDITOR</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">AI-Powered Website Analysis</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-12 items-start">
          {/* Hero Section - Left 2 columns */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                AI-Powered Website Analysis
              </h2>
              <p className="text-xl text-gray-600 mb-2">
                Optimize for Answer Engines & AI Search
              </p>
              <p className="text-gray-500 max-w-3xl text-lg">
                Get comprehensive insights into your website's AI readiness. Analyze domain signals, 
                site structure, and brand visibility across modern AI-powered search platforms.
              </p>
            </div>

            {/* Audit Form */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="domain" className="block text-sm font-semibold text-gray-900 mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="brand" className="block text-sm font-semibold text-gray-900 mb-2">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    id="brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g., Alo Yoga"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="geo" className="block text-sm font-semibold text-gray-900 mb-2">
                    Geography (Optional)
                  </label>
                  <input
                    type="text"
                    id="geo"
                    value={geo}
                    onChange={(e) => setGeo(e.target.value)}
                    placeholder="e.g., United States"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!domain.trim() || !brand.trim() || isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing Website...
                    </span>
                  ) : (
                    'Start AI Audit'
                  )}
                </button>
              </form>

              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium">Analysis Error</p>
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Performance Metrics - Right 1 column */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sticky top-6">
              <div className="flex items-center mb-6">
                <ChartBarIcon className="h-6 w-6 text-blue-600 mr-3" />
                <h3 className="text-xl font-bold text-gray-900">Performance Metrics</h3>
              </div>
              
              <div className="space-y-4">
                <div className="text-center">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-sm font-bold text-emerald-700">Excellent</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">90-100%</p>
                  <p className="text-xs text-gray-500">Outstanding AI readiness</p>
                </div>
                <div className="text-center">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-sm font-bold text-blue-700">Good</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">75-89%</p>
                  <p className="text-xs text-gray-500">Strong optimization</p>
                </div>
                <div className="text-center">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-sm font-bold text-amber-700">Fair</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">60-74%</p>
                  <p className="text-xs text-gray-500">Room for improvement</p>
                </div>
                <div className="text-center">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-sm font-bold text-orange-700">Poor</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">40-59%</p>
                  <p className="text-xs text-gray-500">Needs attention</p>
                </div>
                <div className="text-center">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-sm font-bold text-red-700">Critical</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">0-39%</p>
                  <p className="text-xs text-gray-500">Immediate action required</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden Comprehensive Analysis */}
        <div className="hidden">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Comprehensive Analysis</h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our AI auditor evaluates multiple critical aspects of your website's readiness for modern AI search engines
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="bg-blue-100 rounded-lg p-3 mb-4 inline-block">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Domain Optimization</h4>
              <p className="text-gray-600 text-sm">
                Validates robots.txt, LLM.txt, and sitemap configuration for AI crawler accessibility
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="bg-green-100 rounded-lg p-3 mb-4 inline-block">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Site Structure</h4>
              <p className="text-gray-600 text-sm">
                Analyzes canonical URLs, JSON-LD structured data, and technical SEO elements
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="bg-purple-100 rounded-lg p-3 mb-4 inline-block">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Brand Intelligence</h4>
              <p className="text-gray-600 text-sm">
                Evaluates brand visibility in AI responses and competitive positioning
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
