import React from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

export const CategoryBreakdown = ({ categories }) => {
  const [expandedCategories, setExpandedCategories] = useState({});

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getScoreLevelClass = (level) => {
    const classes = {
      excellent: 'score-excellent',
      good: 'score-good',
      fair: 'score-fair',
      poor: 'score-poor',
      critical: 'score-critical',
    };
    return classes[level] || 'score-fair';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      robots_txt: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      llm_txt: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      sitemap: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      ),
      canonical: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      jsonld: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
    };
    return icons[category] || icons.robots_txt;
  };

  const getCategoryName = (category) => {
    const names = {
      robots_txt: 'Robots.txt',
      llm_txt: 'LLM.txt',
      sitemap: 'Sitemap',
      canonical: 'Canonical URLs',
      jsonld: 'JSON-LD Structured Data',
    };
    return names[category] || category;
  };

  const renderDetailItem = (key, value, depth = 0) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return (
        <div key={key} className={`${depth > 0 ? 'ml-4' : ''} space-y-2`}>
          <div className="font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</div>
          {Object.entries(value).map(([subKey, subValue]) => renderDetailItem(subKey, subValue, depth + 1))}
        </div>
      );
    }
    
    if (Array.isArray(value)) {
      return (
        <div key={key} className={`${depth > 0 ? 'ml-4' : ''} space-y-1`}>
          <div className="font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</div>
          <div className="text-sm text-gray-600 max-h-32 overflow-y-auto">
            {value.map((item, index) => (
              <div key={index} className="truncate">
                {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return (
      <div key={key} className={`${depth > 0 ? 'ml-4' : ''} flex justify-between items-center py-1`}>
        <span className="text-gray-600 capitalize text-sm">{key.replace(/_/g, ' ')}</span>
        <span className="text-gray-900 text-sm font-medium">
          {typeof value === 'boolean' ? (value ? '✅' : '❌') : 
           typeof value === 'number' ? `${Math.round(value)}%` : 
           String(value)}
        </span>
      </div>
    );
  };

  if (!categories || Object.keys(categories).length === 0) {
    return (
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Category Breakdown</h2>
        <div className="text-center py-8 text-gray-500">
          <p>No category data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Category Breakdown</h2>
      
      <div className="space-y-4">
        {Object.entries(categories).map(([categoryKey, category]) => (
          <div key={categoryKey} className="border border-gray-200 rounded-lg overflow-hidden">
            <div 
              className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleCategory(categoryKey)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-gray-600">
                    {getCategoryIcon(categoryKey)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {getCategoryName(categoryKey)}
                    </h3>
                    <p className="text-sm text-gray-600">{category.summary || 'No summary available'}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {Math.round(category.score)}/{Math.round(category.max_score)}
                    </div>
                    <span className={`score-badge ${getScoreLevelClass(category.level)}`}>
                      {category.level ? category.level.charAt(0).toUpperCase() + category.level.slice(1) : 'Unknown'}
                    </span>
                  </div>
                  
                  <button className="text-gray-400 hover:text-gray-600">
                    {expandedCategories[categoryKey] ? (
                      <ChevronDownIcon className="h-5 w-5" />
                    ) : (
                      <ChevronRightIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {expandedCategories[categoryKey] && (
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="space-y-3">
                  {category.details && Object.entries(category.details).map(([detailKey, detail]) => (
                    <div key={detailKey} className="border-l-4 border-blue-200 pl-4">
                      <div className="font-medium text-gray-900 mb-2 capitalize">
                        {detailKey.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        {renderDetailItem(detailKey, detail.details || detail)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
