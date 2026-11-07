import React, { useMemo } from 'react';
import { ArrowsRightLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import AddCompetitorForm from './competitor/AddCompetitorForm';
import ScoreByCategory from './competitor/ScoreByCategory';
import DetailPanel from './competitor/DetailPanel';
import FlowSection from './competitor/FlowSection';
import Overview from './competitor/Overview';
import PendingEntries from './competitor/PendingEntries';
import MentionsStory from './competitor/MentionsStory';
import { useCompetitorComparison } from './competitor/useCompetitorComparison';
import { buildSites } from './competitor/utils';

const STEPS = [
  { id: 'cmp-overview', n: 1, label: 'Overview' },
  { id: 'cmp-categories', n: 2, label: 'Score by category' },
  { id: 'cmp-ai', n: 3, label: 'Who AI assistants mention' },
  { id: 'cmp-detail', n: 4, label: 'Details' },
];

const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// Competitor tab, told as a flow: what could be checked -> how each category scored -> a fair
// head-to-head -> what explains the gap -> AI visibility -> details on demand.
// The comparison list lives on the server (per audit), so it survives refreshes and tab changes.
export default function CompetitorAudit({ auditData }) {
  const runId = auditData?.audit_metadata?.run_id;
  const { overview, loading, error, busy, add, remove, carryOver, hasActive } = useCompetitorComparison(runId);

  const entries = overview?.entries || [];
  const done = entries.filter(e => e.status === 'done');
  const unfinished = entries.filter(e => e.status !== 'done');

  const sites = useMemo(() => (overview ? buildSites(overview, auditData) : []), [overview, auditData]);

  const rerun = (site) => add({ name: site.name, domain: site.requestedUrl || site.domain, refresh: true });
  const retry = (entry) => add({ name: entry.name, domain: entry.requested_url || entry.domain, refresh: true });

  return (
    <div className="space-y-8 w-full">
      {/* Header + form */}
      <div className="bg-gradient-to-r from-rose-600 to-pink-600 rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 p-2.5 rounded-xl"><ArrowsRightLeftIcon className="h-6 w-6" /></div>
          <div>
            <h2 className="text-xl font-black">Competitor Audit</h2>
            <p className="text-rose-200 text-sm">Audit competitor websites and compare them with {auditData?.audit_metadata?.brand || 'your brand'}</p>
          </div>
        </div>

        {runId ? (
          <AddCompetitorForm
            options={overview?.options || []}
            limit={overview?.limit || 5}
            activeCount={entries.length}
            busy={busy}
            onAdd={add}
          />
        ) : (
          <p className="text-sm text-rose-100">This report is not linked to a stored audit. Start a new audit to compare competitors.</p>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-100 bg-red-500/30 px-3 py-2 rounded-lg">
            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {runId && loading && !overview && <div className="text-center py-10 text-sm text-gray-500">Loading comparison…</div>}

      {/* Running / failed audits */}
      <PendingEntries entries={unfinished} onRemove={remove} onRetry={retry} />

      {/* Carry over the competitors of this brand's earlier audit */}
      {overview?.carry_over && (
        <div className="bg-white border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap shadow-sm">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              Reuse the {overview.carry_over.count} competitor{overview.carry_over.count !== 1 ? 's' : ''} from your previous audit?
            </p>
            <p className="text-xs text-gray-500 truncate">
              {overview.carry_over.names.join(', ')} · {new Date(overview.carry_over.finished_at).toLocaleDateString()}.
              Recent audits are reused; AI visibility is re-scored on this audit&apos;s prompts.
            </p>
          </div>
          <button
            onClick={() => carryOver(overview.carry_over.from_run_id)}
            disabled={busy}
            className="text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 px-4 py-2 rounded-lg flex-shrink-0"
          >
            {busy ? 'Adding…' : 'Carry over'}
          </button>
        </div>
      )}

      {/* The flow */}
      {overview && done.length > 0 && (
        <>
          <nav className="sticky top-14 z-10 -mx-1 px-1 py-2 bg-gray-50/90 backdrop-blur flex flex-wrap items-center gap-2" aria-label="Comparison steps">
            {STEPS.map(s => (
              <button key={s.id} onClick={() => jump(s.id)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:border-rose-300 hover:text-rose-700 rounded-full pl-1.5 pr-3 py-1 transition-colors">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[11px] flex items-center justify-center">{s.n}</span>
                {s.label}
              </button>
            ))}
            {hasActive && <span className="text-xs text-gray-400 ml-1">more audits running…</span>}
          </nav>

          <FlowSection id="cmp-overview" step={1} title="Overview"
            subtitle="For each website: how much of the website checklist (Domain Signals and Site Signals) could be checked, and how well it did on that part. A site that blocked most checks is not rated – a blocked check is unknown, not a failure.">
            <Overview sites={sites} onRemove={remove} onRefresh={rerun} />
          </FlowSection>

          <FlowSection id="cmp-categories" step={2} title="Score by category"
            subtitle="What each brand scored in the three audit categories, and how much of each category could be checked. In the bar, green is points earned, red is checked but not earned, hatched is not checked.">
            <ScoreByCategory sites={sites} />
          </FlowSection>

          <FlowSection id="cmp-ai" step={3} title="Who AI assistants mention"
            subtitle={overview.visibility_summary
              ? `AI was asked ${overview.visibility_summary.total_prompts} customer questions across ${overview.visibility_summary.topics} topics. Below: which brands it named, in which topics, and what that adds up to.`
              : 'Which brands AI names when it answers customer questions about this market.'}>
            <MentionsStory overview={overview} sites={sites} />
          </FlowSection>

          <FlowSection id="cmp-detail" step={4} title="Details" subtitle="The raw facts and every individual signal, when you want to dig in.">
            <DetailPanel sites={sites} />
          </FlowSection>
        </>
      )}

      {/* Empty state */}
      {overview && entries.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <ArrowsRightLeftIcon className="h-10 w-10 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500">Pick a competitor, enter its website and click Audit</p>
          <p className="text-xs mt-1">Up to {overview.limit} competitors are compared side by side with your site</p>
        </div>
      )}
    </div>
  );
}
