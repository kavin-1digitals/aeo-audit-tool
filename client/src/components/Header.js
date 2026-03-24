import React from 'react';
import { Link } from 'react-router-dom';
import { ChartBarIcon, HomeIcon } from '@heroicons/react/24/outline';

export const Header = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-3">
            <div className="bg-blue-600 rounded-lg p-2">
              <ChartBarIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AEO Audit Tool</h1>
              <p className="text-xs text-gray-500">Answer Engine Optimization for GenAI</p>
            </div>
          </Link>
          
          <nav className="flex space-x-4">
            <Link
              to="/"
              className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
            >
              <HomeIcon className="h-4 w-4" />
              <span>Home</span>
            </Link>
            <Link
              to="/runs"
              className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
            >
              <ChartBarIcon className="h-4 w-4" />
              <span>Recent Runs</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};
