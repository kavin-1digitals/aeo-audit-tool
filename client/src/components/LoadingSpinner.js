import React from 'react';
import { useAudit } from '../contexts/AuditContext';

export const LoadingSpinner = () => {
  const { isLoading } = useAudit();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-700 font-medium">Analyzing website...</p>
        <p className="text-gray-500 text-sm">This may take a few moments</p>
      </div>
    </div>
  );
};
