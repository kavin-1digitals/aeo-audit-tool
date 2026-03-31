import React, { useState } from 'react';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const QuickRemediationsSection = ({ quickRemediations }) => {
  const [activePlanIndex, setActivePlanIndex] = useState(0);

  if (!quickRemediations || !quickRemediations.plans || quickRemediations.plans.length === 0) {
    return null;
  }

  const plans = quickRemediations.plans;

  const getCategoryClasses = (category) => {
    switch (category) {
      case 'Quick Fix':
        return {
          border: 'border-green-500',
          bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
          badge: 'bg-green-100 text-green-800 border-green-200',
          text: 'text-green-700',
          progressBg: 'bg-green-100',
          progressFill: 'bg-gradient-to-r from-green-400 to-emerald-500',
          icon: CheckCircleIcon,
          iconBg: 'bg-green-100 text-green-600'
        };
      case 'Secondary Fix':
        return {
          border: 'border-yellow-500',
          bg: 'bg-gradient-to-br from-yellow-50 to-amber-50',
          badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          text: 'text-yellow-700',
          progressBg: 'bg-yellow-100',
          progressFill: 'bg-gradient-to-r from-yellow-400 to-amber-500',
          icon: ClockIcon,
          iconBg: 'bg-yellow-100 text-yellow-600'
        };
      case 'Complete Fix':
        return {
          border: 'border-purple-500',
          bg: 'bg-gradient-to-br from-purple-50 to-pink-50',
          badge: 'bg-purple-100 text-purple-800 border-purple-200',
          text: 'text-purple-700',
          progressBg: 'bg-purple-100',
          progressFill: 'bg-gradient-to-r from-purple-400 to-pink-500',
          icon: ExclamationTriangleIcon,
          iconBg: 'bg-purple-100 text-purple-600'
        };
      default:
        return {
          border: 'border-gray-500',
          bg: 'bg-gray-50',
          badge: 'bg-gray-100 text-gray-800 border-gray-200',
          text: 'text-gray-700',
          progressBg: 'bg-gray-100',
          progressFill: 'bg-gray-400',
          icon: CheckCircleIcon,
          iconBg: 'bg-gray-100 text-gray-600'
        };
    }
  };

  const currentPlan = plans[activePlanIndex];
  const classes = getCategoryClasses(currentPlan.category);
  const Icon = classes.icon;

  const nextPlan = () => {
    setActivePlanIndex((prev) => (prev + 1) % plans.length);
  };

  const prevPlan = () => {
    setActivePlanIndex((prev) => (prev - 1 + plans.length) % plans.length);
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Remediation Plans
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Strategic improvements to boost your score from {quickRemediations.current_overall_score.toFixed(1)}% to near-perfect
        </p>
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center items-center space-x-2 mb-6">
        {plans.map((plan, index) => {
          const planClasses = getCategoryClasses(plan.category);
          return (
            <button
              key={index}
              onClick={() => setActivePlanIndex(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === activePlanIndex 
                  ? `${planClasses.progressFill} scale-125 shadow-lg` 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to ${plan.category}`}
            />
          );
        })}
      </div>

      {/* Main Plan Card */}
      <div className={`max-w-4xl mx-auto border-2 rounded-xl shadow-xl overflow-hidden ${classes.border} ${classes.bg}`}>
        {/* Plan Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-lg ${classes.iconBg}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${classes.badge} border`}>
                  {currentPlan.category}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mt-2">
                  {currentPlan.title}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium ${classes.text}`}>
                {currentPlan.difficulty} • {currentPlan.impact_level} Impact
              </div>
              <div className="text-2xl font-bold text-gray-900">
                +{currentPlan.improvement_percentage.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="p-6">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-500">
                {currentPlan.current_score.toFixed(1)}% → {currentPlan.target_score.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-4 rounded-full overflow-hidden bg-gray-200 flex">
              {/* Current Score (Blue) */}
              <div 
                className="h-full transition-all duration-1000 ease-out bg-blue-500"
                style={{ 
                  width: `${currentPlan.current_score}%` 
                }}
              />
              {/* Improvement (Category Color) */}
              <div 
                className={`h-full transition-all duration-1000 ease-out ${classes.progressFill}`}
                style={{ 
                  width: `${((currentPlan.target_score - currentPlan.current_score) / 100) * 100}%` 
                }}
              />
              {/* Remaining (Grey) */}
              <div 
                className="h-full bg-gray-300"
                style={{ 
                  width: `${100 - currentPlan.target_score}%` 
                }}
              />
            </div>
          </div>

          {/* Visual Percentage Graph */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`p-4 rounded-lg ${classes.progressBg}`}>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {currentPlan.current_score.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Current Score</div>
              </div>
            </div>
            <div className={`p-4 rounded-lg ${classes.progressBg}`}>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  +{currentPlan.improvement_percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Potential Gain</div>
              </div>
            </div>
          </div>

          {/* Description and Details */}
          <p className="text-gray-700 mb-4 leading-relaxed">
            {currentPlan.description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className={`p-3 rounded-lg ${classes.progressBg}`}>
              <div className="font-medium text-gray-900">Difficulty</div>
              <div className={`font-bold ${classes.text}`}>{currentPlan.difficulty}</div>
            </div>
            <div className={`p-3 rounded-lg ${classes.progressBg}`}>
              <div className="font-medium text-gray-900">Impact Level</div>
              <div className={`font-bold ${classes.text}`}>{currentPlan.impact_level}</div>
            </div>
            <div className={`p-3 rounded-lg ${classes.progressBg}`}>
              <div className="font-medium text-gray-900">Signals to Fix</div>
              <div className={`font-bold ${classes.text}`}>{currentPlan.signals_count}</div>
            </div>
          </div>
        </div>

        {/* Signals List */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-gray-900">Signals to Fix</h4>
            <span className={`text-sm font-medium ${classes.badge} px-3 py-1 rounded-full`}>
              {currentPlan.signals_count} signals
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {currentPlan.signal_names.map((signalName, index) => (
              <div 
                key={index}
                className={`flex items-center space-x-2 p-3 rounded-lg border ${classes.border} ${classes.bg}`}
              >
                <div className={`w-2 h-2 rounded-full ${classes.progressFill}`} />
                <span className="text-sm font-medium text-gray-700">{signalName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {plans.length > 1 && (
        <div className="flex justify-between items-center max-w-4xl mx-auto mt-6">
          <button
            onClick={prevPlan}
            className={`p-3 rounded-full border-2 ${classes.border} ${classes.bg} hover:opacity-80 transition-opacity`}
            aria-label="Previous plan"
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          
          <div className="text-center">
            <span className="text-sm text-gray-500">
              Plan {activePlanIndex + 1} of {plans.length}
            </span>
          </div>
          
          <button
            onClick={nextPlan}
            className={`p-3 rounded-full border-2 ${classes.border} ${classes.bg} hover:opacity-80 transition-opacity`}
            aria-label="Next plan"
          >
            <ChevronRightIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="text-center mt-8 text-sm text-gray-600">
        Following all {plans.length} phases will optimize your technical SEO and AI visibility
      </div>
    </div>
  );
};

export default QuickRemediationsSection;
