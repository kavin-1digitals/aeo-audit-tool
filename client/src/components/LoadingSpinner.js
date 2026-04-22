import React, { useState, useEffect } from 'react';
import { useAudit } from '../contexts/AuditContext';
import { 
  CheckCircleIcon, 
  ArrowPathIcon, 
  MagnifyingGlassIcon,
  GlobeAltIcon,
  CommandLineIcon,
  SparklesIcon,
  CpuChipIcon,
  ChartPieIcon,
  QueueListIcon,
  PresentationChartLineIcon
} from '@heroicons/react/24/outline';

const progressSteps = [
  { message: "Auditing domain signals (robots.txt, llms.txt, sitemaps)...", icon: GlobeAltIcon },
  { message: "Scanning site structure and header hierarchy...", icon: QueueListIcon },
  { message: "Validating JSON-LD & Structured Data implementation...", icon: CommandLineIcon },
  { message: "Benchmarking brand citations and LLM visibility...", icon: SparklesIcon },
  { message: "Evaluating competitor authority and positioning...", icon: PresentationChartLineIcon },
  { message: "Finalizing AEO scorecard and AI recommendations...", icon: ChartPieIcon }
];

const analysisSteps = [
  { name: "Domain Signals", description: "robots.txt, llms.txt, sitemap", status: "pending" },
  { name: "Site Crawling", description: "page structure & content", status: "pending" },
  { name: "Signal Processing", description: "canonical & JSON-LD analysis", status: "pending" },
  { name: "AI Analysis", description: "OpenAI GPT-4o brand visibility", status: "pending" },
  { name: "Score Calculation", description: "AEO scoring & recommendations", status: "pending" }
];

const aeoTips = [
  "Adding an 'llms.txt' file at your root directory helps AI agents discover your most important content efficiently.",
  "Prioritize JSON-LD structured data to ensure AI search engines accurately understand your product features.",
  "A clear header hierarchy (H1, H2, H3) helps AI agents parse your content's logical flow and key arguments.",
  "Robots.txt should explicitly allow AI crawlers like GPTBot if you want your content to be used in AI search answers.",
  "High citation consistency across third-party sites improves your brand's authority signal for AI search engines.",
  "Use canonical tags correctly to prevent AI search engines from indexing duplicate versions of your content."
];

export const LoadingSpinner = () => {
  const { isLoading } = useAudit();
  const [currentStep, setCurrentStep] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [steps, setSteps] = useState(analysisSteps);
  const [currentTip, setCurrentTip] = useState(0);
  const [fadeTip, setFadeTip] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(0);
      setCurrentTip(0);
      setTimeElapsed(0);
      setSteps(analysisSteps);
      return;
    }

    // Advance general steps
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev < progressSteps.length - 1 ? prev + 1 : prev));
    }, 15000); // Change every 15 seconds

    // Tip cycler with fade effect
    const tipInterval = setInterval(() => {
      setFadeTip(false);
      setTimeout(() => {
        setCurrentTip(prev => (prev + 1) % aeoTips.length);
        setFadeTip(true);
      }, 500);
    }, 8000);

    // Increment timer
    const timeInterval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    // Simulate analysis steps with special timing for final step
    let stepDelay = 15000; // 15 seconds for first 4 steps
    let stepProgressInterval;
    
    const stepProgressFunction = () => {
      setSteps(prev => {
        const next = [...prev];
        const pendingIndex = next.findIndex(s => s.status === 'pending');
        const analyzingIndex = next.findIndex(s => s.status === 'analyzing');
        
        if (analyzingIndex !== -1) {
          // Don't auto-complete the last step (Score Calculation)
          if (analyzingIndex < next.length - 1) {
            next[analyzingIndex].status = 'completed';
            stepDelay = 15000; // Reset to 15 seconds for next step
          } else {
            // This is the final step (Score Calculation) - extend to 6 minutes
            stepDelay = 360000; // 6 minutes in milliseconds (360,000ms)
          }
        }
        
        if (pendingIndex !== -1) {
          next[pendingIndex].status = 'analyzing';
        }
        
        return next;
      });
      
      // Clear and reset interval with new delay
      clearInterval(stepProgressInterval);
      stepProgressInterval = setInterval(stepProgressFunction, stepDelay);
    };
    
    stepProgressInterval = setInterval(stepProgressFunction, stepDelay);

    return () => {
      clearInterval(stepInterval);
      clearInterval(tipInterval);
      clearInterval(timeInterval);
      clearInterval(stepProgressInterval);
      
      // Complete the final step when loading ends
      if (!isLoading) {
        setSteps(prev => {
          const next = [...prev];
          const lastStepIndex = next.length - 1;
          if (next[lastStepIndex].status === 'analyzing') {
            next[lastStepIndex].status = 'completed';
          }
          return next;
        });
      }
    };
  }, [isLoading]);

  if (!isLoading) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate percentage based on current step and progress within that step
  const getProgressPercentage = () => {
    if (!isLoading || currentStep >= progressSteps.length) return 100;
    
    // Base progress from completed steps
    const baseProgress = (currentStep / progressSteps.length) * 100;
    
    // Add gradual progress within current step (0-15% of step value)
    const stepProgress = currentStep < progressSteps.length ? 
      Math.min(15, (timeElapsed % 150) / 150 * 15) : 0;
    
    return Math.round(Math.min(95, baseProgress + stepProgress));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col md:flex-row h-full">
          {/* Left Panel: Main Status */}
          <div className="flex-1 p-8 bg-gradient-to-b from-white to-slate-50 border-r border-slate-100">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Circular Progress */}
              <div className="relative h-32 w-32">
                <svg className="h-full w-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={377}
                    strokeDashoffset={377 - (377 * getProgressPercentage()) / 100}
                    className="text-blue-600 transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{getProgressPercentage()}%</span>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Analyzing AI Readiness</h2>
                <div className="flex items-center justify-center space-x-2 text-slate-500 font-medium h-6">
                  {React.createElement(progressSteps[currentStep].icon, { className: "h-5 w-5 text-blue-500 animate-pulse" })}
                  <span className="transition-all duration-500">{progressSteps[currentStep].message}</span>
                </div>
              </div>

              <div className="w-full bg-slate-100 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex flex-col items-start">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Time Elapsed</span>
                  <span className="text-lg font-mono font-bold text-slate-700">{formatTime(timeElapsed)}</span>
                </div>
                <div className="h-10 w-[1px] bg-slate-200"></div>
                <div className="flex flex-col items-end">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Est. Total</span>
                  <span className="text-lg font-mono font-bold text-slate-700">~01:15</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 w-full text-left min-h-[100px] flex items-center">
                <div className="flex items-start space-x-3 w-full">
                  <SparklesIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
                  <div className={`transition-opacity duration-500 ${fadeTip ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="text-blue-900 font-bold text-sm">AEO Tip</p>
                    <p className="text-blue-700 text-xs leading-relaxed">
                      {aeoTips[currentTip]}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Analysis Steps */}
          <div className="w-full md:w-80 bg-slate-50 p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Analysis Progress</h3>
            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-slate-200/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">{step.name}</span>
                    <span className="text-[10px] text-slate-500">{step.description}</span>
                  </div>
                  {step.status === 'completed' ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                  ) : step.status === 'analyzing' ? (
                    <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-slate-200"></div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <p className="text-[10px] text-slate-400 font-bold">POWERED BY 1DIGITALS AI CORE</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
