import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const ScoreOverview = ({ scorecard }) => {
  if (!scorecard) {
    return (
      <div className="card mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Overall Score</h2>
        <div className="text-center py-8 text-gray-500">
          <p>No score data available</p>
        </div>
      </div>
    );
  }

  // Map audit_metadata properties to expected scorecard structure
  const total_score = scorecard.total_score || 0;
  const max_score = scorecard.total_checks || 1;
  const percentage = scorecard.score_percentage || 0;
  
  // Calculate grade based on percentage
  const getGrade = (percentage) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };
  
  const grade = getGrade(percentage);
  
  // Calculate level based on percentage
  const getLevel = (percentage) => {
    if (percentage >= 90) return 'excellent';
    if (percentage >= 80) return 'good';
    if (percentage >= 70) return 'fair';
    if (percentage >= 60) return 'poor';
    return 'critical';
  };
  
  const level = getLevel(percentage);

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

  const getGradeColor = (grade) => {
    const colors = {
      'A': '#10b981',
      'B': '#3b82f6',
      'C': '#f59e0b',
      'D': '#f97316',
      'F': '#ef4444',
    };
    return colors[grade] || '#6b7280';
  };

  // Ensure percentage is valid and capped at 100
  const safePercentage = Math.min(100, Math.max(0, percentage || 0));
  const safeScore = Math.min(max_score, Math.max(0, total_score || 0));
  const safeMaxScore = Math.max(1, max_score || 1);

  const pieData = [
    { name: 'Score', value: safePercentage },
    { name: 'Remaining', value: 100 - safePercentage }
  ];

  const COLORS = [getGradeColor(grade || 'F'), '#e5e7eb'];

  const getLevelDescription = (level) => {
    const descriptions = {
      excellent: 'Excellent AEO readiness',
      good: 'Good AEO implementation',
      fair: 'Fair AEO optimization needed',
      poor: 'Poor AEO performance',
      critical: 'Critical AEO issues',
    };
    return descriptions[level] || 'Unknown performance level';
  };

  return (
    <div className="card mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Overall Score</h2>
      
      <div className="grid md:grid-cols-2 gap-8 items-center">
        {/* Score Circle */}
        <div className="flex flex-col items-center">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="text-center -mt-32">
            <div className="text-4xl font-bold" style={{ color: getGradeColor(grade || 'F') }}>
              {grade || 'F'}
            </div>
            <div className="text-lg text-gray-600">
              {Math.round(safePercentage)}%
            </div>
          </div>
        </div>

        {/* Score Details */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Total Passed Checks</span>
            <span className="text-2xl font-bold text-green-600">
              {Math.round(safeScore)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Total Failed Checks</span>
            <span className="text-2xl font-bold text-red-600">
              {Math.round(safeMaxScore - safeScore)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Total Checks Performed</span>
            <span className="text-2xl font-bold text-gray-900">
              {Math.round(safeMaxScore)}
            </span>
          </div>
          
          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Performance Level</span>
              <span 
                className="text-lg font-bold px-3 py-1 rounded-full"
                style={{ 
                  backgroundColor: `${getGradeColor(grade || 'F')}20`,
                  color: getGradeColor(grade || 'F')
                }}
              >
                {level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Unknown'}
              </span>
            </div>
            <div className="mt-2 text-right">
              <p className="text-gray-700 font-medium text-sm">
                {getLevelDescription(level || 'critical')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
