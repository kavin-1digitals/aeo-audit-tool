import React, { useState } from 'react';
import { ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

// Shown when audits already exist for the entered brand: reuse a stored one or start a new run.
export const StoredAuditModal = ({ brand, runs, onView, onNewRun, onClose }) => {
  const [selected, setSelected] = useState(runs[0]?.run_id);
  const pick = runs.find(r => r.run_id === selected) || runs[0];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-100 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-blue-50 p-2 rounded-lg"><ClockIcon className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Stored audit found</h3>
            <p className="text-sm text-slate-500">
              {runs.length} previous audit{runs.length !== 1 ? 's' : ''} for <span className="font-semibold">{brand}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto mb-5">
          {runs.map((run, i) => (
            <label
              key={run.run_id}
              className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer ${
                selected === run.run_id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start space-x-3 min-w-0">
                <input type="radio" className="mt-1" checked={selected === run.run_id} onChange={() => setSelected(run.run_id)} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{run.domain || run.requested_url}</p>
                  <p className="text-xs text-slate-500">
                    {run.geo || 'No geo'} · {(run.site_types || []).join(', ') || 'no site type'}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(run.finished_at || run.requested_at)}{i === 0 ? ' · latest' : ''}</p>
                  {run.warnings?.length > 0 && (
                    <p className="text-xs text-amber-600 flex items-center mt-1">
                      <ExclamationTriangleIcon className="h-3.5 w-3.5 mr-1" /> completed with warnings
                    </p>
                  )}
                </div>
              </div>
              <span className="text-sm font-bold text-slate-700 ml-3">
                {run.percentage != null ? `${Math.round(run.percentage)}%` : '—'}
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => onView(pick)}
            className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
          >
            View stored report
          </button>
          <button
            type="button"
            onClick={onNewRun}
            className="flex-1 bg-white text-blue-700 border border-blue-200 font-semibold py-2.5 rounded-xl hover:bg-blue-50 transition-colors"
          >
            Run new audit
          </button>
        </div>
        <button type="button" onClick={onClose} className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </div>
    </div>
  );
};
