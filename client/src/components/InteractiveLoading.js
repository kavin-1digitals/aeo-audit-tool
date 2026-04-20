import React, { useState, useEffect } from 'react';
import { useAudit } from '../contexts/AuditContext';

const tips = [
  {
    title: "AI Optimization Tip",
    content: "Having a llms.txt file can improve your brand's visibility in AI-powered search results by up to 40%."
  },
  {
    title: "Domain Signals Matter", 
    content: "Proper robots.txt configuration helps AI crawlers understand your site structure faster."
  },
  {
    title: "Sitemap Best Practice",
    content: "Keep your sitemap updated weekly to ensure AI models have the latest content information."
  },
  {
    title: "Brand Consistency",
    content: "Consistent brand information across all platforms improves AI recognition and trust signals."
  },
  {
    title: "Content Structure",
    content: "Well-structured content with clear headings helps both search engines and AI models understand your pages."
  }
];

const stats = [
  { label: "Pages Analysed", value: "0", max: 50 },
  { label: "Signals Checked", value: "0", max: 25 },
  { label: "AI Models Queried", value: "0", max: 5 },
  { label: "Recommendations", value: "0", max: 20 }
];

export const InteractiveLoading = () => {
  const { isLoading } = useAudit();
  const [currentTip, setCurrentTip] = useState(0);
  const [animatedStats, setAnimatedStats] = useState(stats);
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (!isLoading) return;

    const tipInterval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % tips.length);
    }, 5000);

    const statsInterval = setInterval(() => {
      setAnimatedStats(prev => prev.map(stat => ({
        ...stat,
        value: Math.min(stat.max, Math.floor(Math.random() * 10) + parseInt(stat.value))
      })));
    }, 2000);

    const timeInterval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(tipInterval);
      clearInterval(statsInterval);
      clearInterval(timeInterval);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">AI Audit in Progress</h2>
            <p className="text-gray-600">We're analyzing your website's AI optimization</p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <span>⏱️ {formatTime(timeElapsed)}</span>
              <span>•</span>
              <span>Estimated 2-5 minutes</span>
            </div>
          </div>

          {/* Live Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {animatedStats.map((stat, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600 tabular-nums">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-600 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Progress Animation */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Analysis Progress</span>
              <span>{Math.min(100, Math.round((timeElapsed / 300) * 100))}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${Math.min(100, Math.round((timeElapsed / 300) * 100))}%` }}
              >
                <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Rotating Tips */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-start space-x-3">
              <div className="text-2xl">💡</div>
              <div>
                <h3 className="font-semibold text-blue-900 text-sm">{tips[currentTip].title}</h3>
                <p className="text-blue-700 text-xs mt-1 leading-relaxed">{tips[currentTip].content}</p>
              </div>
            </div>
          </div>

          {/* What's happening */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-800 text-sm">What we're checking:</h3>
            <div className="space-y-1">
              {[
                "Domain configuration (robots.txt, sitemap, llms.txt)",
                "Website structure and content analysis", 
                "AI brand visibility across platforms",
                "Search engine optimization signals",
                "Generating personalized recommendations"
              ].map((item, index) => (
                <div key={index} className="flex items-center space-x-2 text-xs text-gray-600">
                  <div className={`w-2 h-2 rounded-full ${
                    index <= Math.floor(timeElapsed / 60) ? 'bg-green-500' : 'bg-gray-300'
                  }`}></div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cancel option */}
          <div className="text-center">
            <button className="text-gray-500 hover:text-gray-700 text-sm underline">
              Cancel analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
