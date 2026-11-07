import React from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const STAGE_TEXT = {
  domain_signals: 'Checking robots.txt, llms.txt & sitemap…',
  site_crawl: 'Crawling the website…',
  site_processing: 'Analysing canonical, JSON-LD & meta tags…',
  scoring: 'Calculating score…',
  persist: 'Saving result…',
};

// Cards for competitor audits that are still running or have failed.
export default function PendingEntries({ entries, onRemove, onRetry }) {
  if (!entries.length) return null;
  return (
    <div className="space-y-3">
      {entries.map((e) => {
        const failed = e.status === 'failed';
        return (
          <div key={e.comparison_id} className={`rounded-xl border p-4 bg-white flex items-center justify-between gap-4 ${failed ? 'border-red-200' : 'border-gray-200'}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{e.name} <span className="text-xs font-normal text-gray-400">{e.domain}</span></p>
              {failed ? (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" /> {e.error || 'Audit failed'}
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-rose-500" />
                    {e.status === 'pending' ? 'Queued…' : STAGE_TEXT[e.stage_key] || 'Auditing…'}
                  </p>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 transition-all duration-700" style={{ width: `${Math.max(3, e.progress_pct)}%` }} />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {failed && (
                <button onClick={() => onRetry(e)} className="text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg">
                  Retry
                </button>
              )}
              <button onClick={() => onRemove(e.comparison_id)} title="Remove" className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
