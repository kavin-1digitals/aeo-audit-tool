import React from 'react';
import { humanize, signalRows } from './utils';

const cellStyle = (info) => {
  if (!info) return { cls: 'bg-gray-50 text-gray-400', label: 'n/a' };
  const label = info.total > 1 ? `${info.passed}/${info.total}` : info.passed ? 'Pass' : 'Fail';
  if (info.rate >= 0.999) return { cls: 'bg-green-100 text-green-800', label };
  if (info.rate <= 0.001) return { cls: 'bg-red-100 text-red-700', label };
  return { cls: 'bg-amber-100 text-amber-800', label };
};

// Pass-rate heat-map: a signal can be checked on many pages, so show n/m, not just pass/fail.
export default function SignalMatrix({ sites }) {
  const groups = signalRows(sites);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-gray-900">Signal-by-signal comparison</h3>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200" />All pass</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200" />Partial</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200" />Fail</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200" />n/a = could not be checked</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse" style={{ minWidth: `${208 + sites.length * 128}px`, width: '100%' }}>
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500">
              <th className="py-2 px-4 text-left font-medium sticky left-0 bg-white z-10 w-52 min-w-[13rem]">Signal</th>
              {sites.map(s => (
                <th key={s.id} className="py-2 px-3 text-center font-semibold min-w-[8rem]" style={{ color: s.color }}>
                  <div className="max-w-[110px] truncate mx-auto" title={s.name}>{s.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([group, rows]) => (
              <React.Fragment key={group}>
                <tr><td colSpan={sites.length + 1} className="px-4 py-1.5 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider sticky left-0">{group}</td></tr>
                {rows.map(row => (
                  <tr key={row.name} className="border-b border-gray-50">
                    <td className="py-2 px-4 text-xs font-medium text-gray-700 sticky left-0 bg-white z-10">{humanize(row.name)}</td>
                    {sites.map(s => {
                      const { cls, label } = cellStyle(s.rates.get(row.name));
                      return (
                        <td key={s.id} className="py-1.5 px-3 text-center">
                          <span className={`inline-block min-w-[3rem] text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
