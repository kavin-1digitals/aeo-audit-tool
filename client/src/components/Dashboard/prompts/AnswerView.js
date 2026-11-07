import React, { useState } from 'react';
import { MODES, highlightParts } from './utils';

// The two stored answers of a prompt, with brand (blue) and competitor (amber) names highlighted.
export default function AnswerView({ prompt, brand, rivals }) {
  const [mode, setMode] = useState(prompt.mentions[brand]?.web || !prompt.mentions[brand]?.llm ? 'web' : 'llm');
  const text = mode === 'web' ? prompt.web_answer : prompt.llm_answer;
  const names = [brand, ...rivals];

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex gap-2 mb-2">
        {Object.entries(MODES).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`text-xs font-semibold px-3 py-1 rounded-full border ${mode === key ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 rounded-lg p-3">
        {highlightParts(text, names).map((part, i) => (
          part.hit
            ? <mark key={i} className={`rounded px-0.5 font-semibold ${part.hit === brand ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'}`}>{part.text}</mark>
            : <React.Fragment key={i}>{part.text}</React.Fragment>
        ))}
      </p>
    </div>
  );
}
