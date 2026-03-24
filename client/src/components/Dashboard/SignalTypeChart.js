import React from 'react';

const SignalTypeChart = ({ categories }) => {
  // Calculate pass/fail data for each signal type
  const getSignalTypeData = () => {
    const signalTypes = {};
    
    Object.entries(categories).forEach(([categoryName, categoryData]) => {
      const mainSignalType = categoryName.split(' -> ')[0];
      
      if (!signalTypes[mainSignalType]) {
        signalTypes[mainSignalType] = {
          passed: 0,
          failed: 0,
          total: 0
        };
      }
      
      categoryData.scores.forEach(score => {
        if (score.value > 0) {
          signalTypes[mainSignalType].passed++;
        } else if (score.value < 0) {
          signalTypes[mainSignalType].failed++;
        }
        signalTypes[mainSignalType].total++;
      });
    });
    
    return signalTypes;
  };

  const signalTypeData = getSignalTypeData();
  const signalTypes = Object.keys(signalTypeData);

  // Calculate percentages
  const getPercentage = (passed, total) => {
    if (total === 0) return 0;
    return Math.round((passed / total) * 100);
  };

  // Get color based on percentage
  const getBarColor = (percentage) => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-blue-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusText = (percentage) => {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 75) return 'Good';
    if (percentage >= 60) return 'Fair';
    return 'Poor';
  };

  // Get bar color based on pass/fail status
  const getBarColorByStatus = (passed, total) => {
    if (passed === total) return 'bg-emerald-600';
    if (passed === 0) return 'bg-rose-600';
    return 'bg-emerald-600'; // Always emerald for passed portion
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Overview</h3>
        
        <div className="space-y-5">
          {signalTypes.map((signalType) => {
            const data = signalTypeData[signalType];
            const passPercentage = getPercentage(data.passed, data.total);
            const failPercentage = getPercentage(data.failed, data.total);
            
            return (
              <div key={signalType} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900 w-1/3">{signalType}</h4>
                  <div className="flex items-center justify-center w-1/3">
                    <span className="text-sm font-bold text-black">
                      {data.passed}/{data.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-end w-1/3">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(passPercentage)} bg-opacity-10`}>
                      {getStatusText(passPercentage)}
                    </span>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div 
                      className={`h-full ${getBarColorByStatus(data.passed, data.total)} transition-all duration-500 ease-out`}
                      style={{ width: `${passPercentage}%` }}
                    >
                      <div className="h-full bg-white bg-opacity-20 flex items-center justify-center">
                        {passPercentage > 10 && (
                          <span className="text-xs font-medium text-white">
                            {passPercentage}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Failed indicator - extends from right to cover failed portion */}
                  {data.failed > 0 && (
                    <div 
                      className="absolute top-0 h-6 bg-rose-600 bg-opacity-80 flex items-center justify-center rounded-r-full"
                      style={{ 
                        right: 0,
                        width: `${failPercentage}%`,
                        left: 'auto'
                      }}
                    >
                      <span className="text-xs font-medium text-white">
                        {failPercentage}%
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between text-xs text-gray-600 font-medium px-4">
                  <span className="text-center flex-1 text-left pl-4">Passed: {data.passed}</span>
                  <span className="text-center flex-1">Total: {data.total}</span>
                  <span className="text-center flex-1 text-right pr-4">Failed: {data.failed}</span>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Summary */}
        <div className="mt-8 pt-6 border-t border-gray-300">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-emerald-600">
                {Object.values(signalTypeData).reduce((sum, data) => sum + data.passed, 0)}
              </p>
              <p className="text-xs font-medium text-gray-700 mt-1">Total Passed</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-rose-600">
                {Object.values(signalTypeData).reduce((sum, data) => sum + data.failed, 0)}
              </p>
              <p className="text-xs font-medium text-gray-700 mt-1">Total Failed</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">
                {Object.values(signalTypeData).reduce((sum, data) => sum + data.total, 0)}
              </p>
              <p className="text-xs font-medium text-gray-700 mt-1">Total Checks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignalTypeChart;
