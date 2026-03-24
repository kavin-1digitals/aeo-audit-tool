import React from 'react';

const TopIssues = ({ categories, pathScorecard }) => {
  // Get real failed issues from different signal paths using the original path_scorecard
  const getFailedIssuesFromDifferentPaths = () => {
    const failedIssues = [];
    
    try {
      console.log('Getting failed issues from path_scorecard...');
      console.log('Path scorecard structure:', Object.keys(pathScorecard));
      
      if (!pathScorecard || typeof pathScorecard !== 'object') {
        console.log('No path_scorecard data found');
        return [];
      }
      
      // Process each path in path_scorecard directly
      Object.entries(pathScorecard).forEach(([pathKey, pathData]) => {
        console.log(`Processing path: ${pathKey}`, pathData);
        
        if (pathData && pathData.scores && Array.isArray(pathData.scores)) {
          console.log(`Found ${pathData.scores.length} scores in ${pathKey}`);
          
          pathData.scores.forEach((signal, index) => {
            console.log(`Signal ${index}:`, signal);
            
            // Check for failed signals (score === 0 or negative)
            const isFailed = signal.score === 0 || 
                           signal.score === 0.0 || 
                           signal.score < 0 ||
                           signal.value === 0 || 
                           signal.value === 0.0 ||
                           signal.value < 0;
            
            console.log(`Signal score: ${signal.score}, isFailed: ${isFailed}`);
            
            if (isFailed) {
              // Extract category from pathKey (first part before ->)
              const category = pathKey.split(' -> ')[0] || 'Unknown';
              
              // Create a UI-friendly title
              let specificTitle = signal.title || signal.signal_name || `Failed Signal ${index + 1}`;
              
              // Convert signal_name to UI-friendly format (remove underscores, capitalize)
              if (signal.signal_name) {
                const friendlyName = signal.signal_name
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase());
                specificTitle = friendlyName;
              }
              
              // Add query/prompt info for LLM signals to make them unique
              const details = [];
              
              if (signal.query_type || signal.query) {
                const queryInfo = signal.query_type || signal.query;
                details.push(queryInfo.length > 30 ? queryInfo.substring(0, 30) + '...' : queryInfo);
              }
              
              if (signal.prompt_type || signal.prompt_cluster) {
                const promptInfo = signal.prompt_type || signal.prompt_cluster;
                const friendlyPrompt = promptInfo
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase());
                details.push(friendlyPrompt.length > 30 ? friendlyPrompt.substring(0, 30) + '...' : friendlyPrompt);
              }
              
              // Add query number or identifier for LLM signals
              if (pathKey.includes('query_') || pathKey.includes('_query')) {
                const queryMatch = pathKey.match(/query_(\d+)/) || pathKey.match(/(\d+)_query/);
                if (queryMatch) {
                  details.push(`Query ${queryMatch[1]}`);
                }
              }
              
              // Build final title with additional details only if needed
              if (details.length > 0) {
                specificTitle = `${specificTitle} (${details.join(', ')})`;
              }
              
              const issue = {
                id: `${pathKey}-${index}`,
                category: category,
                pathKey: pathKey,
                title: specificTitle,
                originalTitle: signal.title || signal.signal_name,
                signalName: signal.signal_name,
                queryType: signal.query_type,
                promptCluster: signal.prompt_cluster,
                remediation: signal.remediation_plan || 
                             signal.remediation || 
                             signal.details || 
                             `Fix this ${category} issue to improve overall performance`,
                score: signal.score || signal.value || 0,
                successState: signal.success_state || signal.successState || 'Failed'
              };
              
              failedIssues.push(issue);
              console.log(`Added failed issue: ${specificTitle}`);
            }
          });
        } else {
          console.log(`No scores array found for ${pathKey}`);
        }
      });
      
      console.log(`Total failed issues found: ${failedIssues.length}`);
      
      // Sort to get diverse issues (one from each category first, then others)
      const sortedIssues = [];
      const usedCategories = new Set();
      const usedPaths = new Set();
      
      // First, add one issue from each category
      failedIssues.forEach(issue => {
        if (!usedCategories.has(issue.category) && sortedIssues.length < 5) {
          sortedIssues.push(issue);
          usedCategories.add(issue.category);
          usedPaths.add(issue.pathKey);
        }
      });
      
      // Then add remaining issues from different paths to fill up to 5
      failedIssues.forEach(issue => {
        if (sortedIssues.length >= 5) return;
        if (!sortedIssues.find(si => si.id === issue.id) && !usedPaths.has(issue.pathKey)) {
          sortedIssues.push(issue);
          usedPaths.add(issue.pathKey);
        }
      });
      
      console.log(`Final issues selected: ${sortedIssues.length} from ${usedCategories.size} categories and ${usedPaths.size} different paths`);
      
      return sortedIssues;
      
    } catch (error) {
      console.error('Error getting failed issues from different paths:', error);
      return [];
    }
  };

  const realFailedIssues = getFailedIssuesFromDifferentPaths();

  // Show real failed issues or empty state
  if (realFailedIssues.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Issues</h3>
        <div className="text-center py-8">
          <div className="text-green-500 text-4xl mb-2">✓</div>
          <p className="text-gray-600 font-medium">No critical issues found!</p>
          <p className="text-sm text-gray-500 mt-1">All signals are passing successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Issues to Fix</h3>
      
      <div className="space-y-3">
        {realFailedIssues.map((issue, index) => (
          <div key={issue.id} className="border-l-4 border-red-500 pl-4 py-3 bg-red-50 rounded-r">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                    {issue.category}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    #{index + 1}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                    Score: {issue.score}
                  </span>
                </div>
                
                <h4 className="font-medium text-gray-900 mb-2">{issue.title}</h4>
                
                <div className="bg-white rounded p-3 border border-red-100">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-red-600">Action Required:</span> {issue.remediation}
                  </p>
                </div>
              </div>
              
              <div className="ml-4 flex-shrink-0 flex items-center space-x-2">
                <span className="text-xs px-2 py-1 bg-red-600 text-white rounded-full font-medium">
                  Failed
                </span>
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Found {realFailedIssues.length} critical issue{realFailedIssues.length !== 1 ? 's' : ''} requiring immediate attention
        </p>
      </div>
    </div>
  );
};

export default TopIssues;
