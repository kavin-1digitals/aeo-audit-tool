import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { ClockIcon, TrashIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

const STORAGE_KEY = 'aeo_audit_history';
const MAX_HISTORY = 20;

export function saveAuditToHistory(auditData) {
  try {
    const meta = auditData.audit_metadata || {};
    const entry = {
      id: Date.now(),
      timestamp: meta.timestamp || new Date().toISOString(),
      domain: meta.domain || '',
      brand: meta.brand || '',
      location: meta.location || '',
      score: parseFloat((meta.percentage || meta.score_percentage || 0).toFixed(1)),
      total_checks: meta.total_checks || 0
    };
    const existing = loadHistory();
    const updated = [entry, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

const formatDate = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

const scoreColor = (score) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

const scoreBg = (score) => {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-yellow-100';
  return 'bg-red-100';
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold text-gray-900">{d.brand || d.domain}</p>
        <p className="text-gray-500 text-xs">{formatDate(d.timestamp)}</p>
        <p className="mt-1 font-bold text-blue-700">{d.score}% AEO Score</p>
      </div>
    );
  }
  return null;
};

const AuditHistory = ({ currentAuditData }) => {
  const [history, setHistory] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Save current audit on mount
  useEffect(() => {
    if (currentAuditData?.audit_metadata?.domain) {
      const updated = saveAuditToHistory(currentAuditData);
      setHistory(updated);
    }
  }, [currentAuditData?.audit_metadata?.domain]);

  if (history.length === 0) return null;

  const trendData = [...history].reverse().map((h, i) => ({ ...h, index: i + 1 }));
  const displayed = showAll ? history : history.slice(0, 5);
  const latestScore = history[0]?.score || 0;
  const prevScore = history[1]?.score;
  const trend = prevScore != null ? latestScore - prevScore : null;

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-2">
          <div className="bg-indigo-50 p-2 rounded-lg">
            <ClockIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Audit History & Trends</h3>
            <p className="text-sm text-gray-500">{history.length} audit{history.length !== 1 ? 's' : ''} tracked</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {trend !== null && (
            <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-semibold ${trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <ArrowTrendingUpIcon className={`h-4 w-4 ${trend < 0 ? 'rotate-180' : ''}`} />
              <span>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}% vs last</span>
            </div>
          )}
          <button
            onClick={() => { clearHistory(); setHistory([]); }}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
            title="Clear history"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Trend Chart */}
      {trendData.length >= 2 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Score Trend</h4>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="index" tick={{ fontSize: 10 }} label={{ value: 'Audit #', position: 'insideBottomRight', offset: -4, fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={80} stroke="#10B981" strokeDasharray="4 4" label={{ value: 'Good', fontSize: 10, fill: '#10B981' }} />
              <ReferenceLine y={60} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Fair', fontSize: 10, fill: '#F59E0B' }} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3B82F6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History List */}
      <div>
        <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Recent Audits</h4>
        <div className="space-y-2">
          {displayed.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${i === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`text-xs font-bold px-2 py-1 rounded-full ${scoreBg(entry.score)} ${scoreColor(entry.score)}`}>
                  {entry.score}%
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{entry.brand || entry.domain}</p>
                  <p className="text-xs text-gray-500 truncate">{entry.domain}</p>
                </div>
              </div>
              <div className="text-xs text-gray-400 flex-shrink-0 ml-3 text-right">
                <p>{formatDate(entry.timestamp)}</p>
                {i === 0 && <p className="text-blue-500 font-medium">Latest</p>}
              </div>
            </div>
          ))}
        </div>
        {history.length > 5 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mt-3 w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-1"
          >
            {showAll ? 'Show less' : `Show all ${history.length} audits`}
          </button>
        )}
      </div>
    </div>
  );
};

export default AuditHistory;
