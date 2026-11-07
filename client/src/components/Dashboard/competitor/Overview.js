import React from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { STATUS, fmtPts, level, limitationNote } from './utils';

const Pct = ({ value, className = '' }) => <span className={className}>{value == null ? '—' : `${Math.round(value)}%`}</span>;

function Row({ site, onRemove, onRefresh }) {
  const s = site.summary;
  const note = limitationNote(site);
  const lv = level(site.scorePct);
  const status = STATUS[site.confidence];

  return (
    <div className={`px-4 py-4 ${site.isBrand ? 'bg-blue-50/60' : ''}`}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-3 items-center">
        {/* Site */}
        <div className="md:col-span-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: site.color }} />
            <span className="font-bold text-gray-900 truncate" title={site.name}>{site.name}</span>
            {site.isBrand && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">YOU</span>}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <p className="text-xs text-gray-400 truncate">{site.domain}</p>
            {!site.isBrand && (
              <span className="flex items-center ml-auto md:ml-1 flex-shrink-0">
                {onRefresh && <button onClick={() => onRefresh(site)} title="Re-run this audit" className="p-1 text-gray-300 hover:text-blue-600"><ArrowPathIcon className="h-3.5 w-3.5" /></button>}
                {onRemove && <button onClick={() => onRemove(site.id)} title="Remove from comparison" className="p-1 text-gray-300 hover:text-red-500"><XMarkIcon className="h-3.5 w-3.5" /></button>}
              </span>
            )}
          </div>
        </div>

        {/* 1. How much of the audit was completed */}
        <div className="md:col-span-4">
          <div className="flex items-baseline justify-between mb-1">
            <Pct value={site.coveragePct} className="text-xl font-bold text-gray-800" />
            <span className="text-xs text-gray-400">{s ? `${fmtPts(s.analysed)} of ${fmtPts(s.full)} points checked` : ''}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${site.coveragePct || 0}%` }} />
          </div>
        </div>

        {/* 2. How it did on the part that was checked */}
        <div className="md:col-span-4">
          {site.rated ? (
            <>
              <div className="flex items-baseline justify-between mb-1">
                <Pct value={site.scorePct} className={`text-xl font-bold ${lv.text}`} />
                <span className="text-xs text-gray-400">{fmtPts(s.earned)} of {fmtPts(s.analysed)} points earned</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${lv.bar}`} style={{ width: `${site.scorePct}%` }} />
              </div>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-gray-400">Not rated</p>
              <p className="text-xs text-gray-400">Too little could be checked to judge this site fairly</p>
            </>
          )}
        </div>

        {/* Reliability */}
        <div className="md:col-span-1 md:text-right">
          <span className={`inline-block text-[10px] font-bold px-2 py-1 rounded-full leading-tight ${status.cls}`}>{status.label}</span>
        </div>
      </div>

      {note && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-px" />
          <span>{note}{site.reused && site.takenAt ? ` (audit from ${new Date(site.takenAt).toLocaleDateString()})` : ''}</span>
        </p>
      )}
    </div>
  );
}

// Scoreboard: per site, (1) how much of the checklist could be completed and (2) the score on that part.
export default function Overview({ sites, onRemove, onRefresh }) {
  const ranked = sites.filter(s => s.rated).sort((a, b) => b.scorePct - a.scorePct);
  const rank = ranked.findIndex(s => s.isBrand) + 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-x-6 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
        <div className="col-span-3">Website</div>
        <div className="col-span-4" title="How much of the checklist could actually be reached">Audit completed</div>
        <div className="col-span-4" title="Points earned out of the points that were checked">Score on what was checked</div>
        <div className="col-span-1 text-right">Data</div>
      </div>
      <div className="divide-y divide-gray-100">
        {sites.map(site => <Row key={site.id} site={site} onRemove={onRemove} onRefresh={onRefresh} />)}
      </div>
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          <b className="text-gray-700">Audit completed</b> = share of the checklist that could be reached.{' '}
          <b className="text-gray-700">Score</b> = how well the site did on that part only.
        </span>
        {rank > 0 && ranked.length > 1 && <span className="font-bold text-blue-700">You rank #{rank} of {ranked.length} rated sites</span>}
      </div>
    </div>
  );
}
