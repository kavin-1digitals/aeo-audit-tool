import React, { useMemo, useState } from 'react';
import { BeakerIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import FlowSection from './competitor/FlowSection';
import Explorer from './prompts/Explorer';
import Opportunities from './prompts/Opportunities';
import Standing from './prompts/Standing';
import Wins from './prompts/Wins';
import { usePromptMatrix } from './prompts/usePromptMatrix';
import { analyse } from './prompts/utils';

const Empty = ({ title, text }) => (
  <div className="max-w-xl mx-auto text-center py-20">
    <div className="bg-indigo-100 rounded-full p-6 inline-block mb-4"><BeakerIcon className="h-12 w-12 text-indigo-500" /></div>
    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-500">{text}</p>
  </div>
);

// Prompts Lab: what AI answers to the questions your customers ask - and where it recommends others instead of you.
// Built from the answers stored with the audit (web search + AI model), so it costs no extra AI calls and
// automatically includes the competitors you add in the Competitor tab.
export default function PromptsLab({ auditData }) {
  const runId = auditData?.audit_metadata?.run_id;
  const { matrix, loading, error } = usePromptMatrix(runId);
  const analysis = useMemo(() => (matrix?.available ? analyse(matrix) : null), [matrix]);
  const [showWins, setShowWins] = useState(false);

  if (!runId) return <Empty title="Prompts Lab needs a stored audit" text="This report is not linked to a stored audit. Start a new audit to explore its prompts." />;
  if (loading) return <div className="text-center py-20 text-sm text-gray-500">Loading prompts…</div>;
  if (error) return <Empty title="Could not load prompts" text={error} />;
  if (!analysis || analysis.total === 0) {
    return <Empty title="No prompt data for this audit" text="The AI part of this audit did not complete, so there are no prompts or answers to explore. Run a new audit to populate this tab." />;
  }

  return (
    <div className="space-y-8 w-full">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2.5 rounded-xl"><BeakerIcon className="h-6 w-6" /></div>
          <div>
            <h2 className="text-xl font-black">Prompts Lab</h2>
            <p className="text-violet-200 text-sm">
              {analysis.total} questions your customers might ask AI – and who it recommends in {analysis.brand}&apos;s place
            </p>
          </div>
        </div>
      </div>

      <FlowSection step={1} title="Where you stand"
        subtitle="How often AI recommends you, in web-search answers and in answers from the model alone, and how each topic compares with the strongest competitor.">
        <Standing analysis={analysis} />
      </FlowSection>

      <FlowSection step={2} title="Missed opportunities"
        subtitle="Questions where AI names competitors but not you. The top ones are the best places to create or improve content.">
        <Opportunities analysis={analysis} />
      </FlowSection>

      <FlowSection step={3} title="Where you are recommended" subtitle="Questions where you are already named – what to protect.">
        <button onClick={() => setShowWins(!showWins)} className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-violet-700">
          {showWins ? 'Hide' : 'Show'} {analysis.won.length} prompt{analysis.won.length === 1 ? '' : 's'}
          <ChevronDownIcon className={`h-4 w-4 transition-transform ${showWins ? 'rotate-180' : ''}`} />
        </button>
        {showWins && <Wins analysis={analysis} />}
      </FlowSection>

      <FlowSection step={4} title="Every prompt" subtitle="All prompts against all brands. Click a row to read the full answers.">
        <Explorer analysis={analysis} entities={matrix.entities} />
      </FlowSection>
    </div>
  );
}
