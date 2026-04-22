import React, { useState } from 'react';
import {
  ArrowDownTrayIcon, CodeBracketIcon, TableCellsIcon,
  DocumentTextIcon, CheckCircleIcon, ClipboardDocumentIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

function buildCSV(auditData) {
  const scores = auditData?.raw_scorecard?.scores || [];
  const header = ['signal_name', 'value', 'weight', 'score_contribution', 'signal_path', 'remediation_plan'];
  const rows = scores.map(s => [
    s.signal_name || '',
    s.value ?? '',
    s.weight ?? '',
    s.score_contribution ?? '',
    (s.signal_path || []).join(' > '),
    (s.remediation_plan || '').replace(/"/g, '""'),
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  return csv;
}

function buildJSON(auditData) {
  return JSON.stringify(auditData, null, 2);
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getScoreBadgeHTML(score, domain) {
  const color = score >= 75 ? '#16a34a' : score >= 50 ? '#2563eb' : '#dc2626';
  const label = score >= 75 ? 'Excellent' : score >= 50 ? 'Good' : 'Needs Work';
  return `<!-- AEO Score Badge -->
<a href="https://aeo-audit-tool.vercel.app" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:#1e1b4b;border-radius:10px;text-decoration:none;font-family:sans-serif;">
  <span style="color:#a5b4fc;font-size:11px;font-weight:600;">AEO Score</span>
  <span style="background:${color};color:#fff;font-size:14px;font-weight:900;padding:2px 10px;border-radius:6px;">${score.toFixed(1)}%</span>
  <span style="color:#6366f1;font-size:11px;font-weight:600;">${label}</span>
</a>`;
}

const ExportCard = ({ icon: Icon, title, description, action, color = 'blue', disabled = false }) => (
  <div className={`border rounded-xl p-5 flex items-start gap-4 transition-all ${disabled ? 'opacity-50 bg-gray-50' : 'bg-white hover:shadow-sm border-gray-200'}`}>
    <div className={`flex-shrink-0 p-2.5 rounded-xl bg-${color}-100`}>
      <Icon className={`h-5 w-5 text-${color}-600`} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">{description}</p>
      <button
        onClick={action}
        disabled={disabled}
        className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors ${
          disabled
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : `bg-${color}-600 text-white hover:bg-${color}-700`
        }`}
      >
        {disabled ? 'Not available' : 'Download'}
      </button>
    </div>
  </div>
);

export default function ExportCentre({ auditData }) {
  const [copied, setCopied] = useState(false);
  const [badgeCopied, setBadgeCopied] = useState(false);

  const meta = auditData?.audit_metadata || {};
  const score = parseFloat((meta.percentage || meta.score_percentage || 0).toFixed(1));
  const domain = meta.domain || meta.url || 'your-site.com';
  const timestamp = meta.timestamp || new Date().toISOString();
  const dateStr = new Date(timestamp).toISOString().split('T')[0];

  const handleCSV = () => {
    const csv = buildCSV(auditData);
    downloadBlob(csv, `aeo-audit-${domain}-${dateStr}.csv`, 'text/csv');
  };

  const handleJSON = () => {
    const json = buildJSON(auditData);
    downloadBlob(json, `aeo-audit-${domain}-${dateStr}.json`, 'application/json');
  };

  const handleSummaryTxt = () => {
    const scores = auditData?.raw_scorecard?.scores || [];
    const passing = scores.filter(s => s.value > 0).length;
    const failing = scores.filter(s => s.value < 0).length;
    const lines = [
      `AEO Audit Summary`,
      `=================`,
      `Domain: ${domain}`,
      `Date: ${dateStr}`,
      `Overall Score: ${score}%`,
      ``,
      `Signal Results`,
      `--------------`,
      `Passing: ${passing}`,
      `Failing: ${failing}`,
      ``,
      `Failing Signals`,
      `---------------`,
      ...scores
        .filter(s => s.value < 0 && s.remediation_plan)
        .map(s => `- ${s.signal_name.replace(/_/g, ' ')}: ${s.remediation_plan?.slice(0, 120)}...`),
    ];
    downloadBlob(lines.join('\n'), `aeo-summary-${domain}-${dateStr}.txt`, 'text/plain');
  };

  const badgeHTML = getScoreBadgeHTML(score, domain);

  const handleCopyBadge = () => {
    navigator.clipboard.writeText(badgeHTML).then(() => {
      setBadgeCopied(true);
      setTimeout(() => setBadgeCopied(false), 2000);
    });
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(buildJSON(auditData)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="bg-gradient-to-r from-sky-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <ArrowDownTrayIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">Export Centre</h2>
            <p className="text-sky-200 text-sm">Download your audit data in any format</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black">{score}%</div>
            <div className="text-sky-200 text-xs mt-0.5">Overall Score</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black">{domain}</div>
            <div className="text-sky-200 text-xs mt-0.5">Domain</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black">{dateStr}</div>
            <div className="text-sky-200 text-xs mt-0.5">Audit Date</div>
          </div>
        </div>
      </div>

      {/* Export options */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 px-1 mb-3">Data Exports</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ExportCard
            icon={TableCellsIcon}
            title="CSV — All Signals"
            description="Every signal with value, weight, contribution and remediation. Import into Excel or Google Sheets."
            action={handleCSV}
            color="emerald"
          />
          <ExportCard
            icon={CodeBracketIcon}
            title="JSON — Full Audit"
            description="Complete raw audit data as JSON. Use for custom integrations, CI/CD pipelines, or archiving."
            action={handleJSON}
            color="indigo"
          />
          <ExportCard
            icon={DocumentTextIcon}
            title="Text Summary"
            description="Human-readable plain text with score, passing/failing signals and all remediation notes."
            action={handleSummaryTxt}
            color="blue"
          />
        </div>
      </div>

      {/* Score badge */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-indigo-500" />
          Embeddable Score Badge
        </h3>
        <p className="text-xs text-gray-500 mb-4">Copy the HTML snippet below and embed it on your website or README.</p>

        {/* Live preview */}
        <div className="mb-4 p-4 bg-gray-900 rounded-xl flex items-center justify-center">
          <div dangerouslySetInnerHTML={{ __html: badgeHTML }} />
        </div>

        {/* Code block */}
        <div className="relative">
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-700 leading-relaxed whitespace-pre-wrap">
            {badgeHTML}
          </pre>
          <button
            onClick={handleCopyBadge}
            className={`absolute top-2 right-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              badgeCopied ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {badgeCopied ? <><CheckCircleIcon className="h-3.5 w-3.5" />Copied!</> : <><ClipboardDocumentIcon className="h-3.5 w-3.5" />Copy HTML</>}
          </button>
        </div>
      </div>

      {/* Copy JSON button */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">Copy JSON to clipboard</p>
          <p className="text-xs text-gray-500">Paste directly into a Notion database, Slack message, or API call</p>
        </div>
        <button
          onClick={handleCopyJSON}
          className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
            copied ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {copied ? <><CheckCircleIcon className="h-4 w-4" />Copied!</> : <><ClipboardDocumentIcon className="h-4 w-4" />Copy JSON</>}
        </button>
      </div>
    </div>
  );
}
