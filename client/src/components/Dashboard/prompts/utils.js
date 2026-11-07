// Pure analysis for the Prompts Lab (no React).
//
// Data: every prompt of the audit was answered twice (web search, and the AI model alone) and we know who was
// mentioned in each answer. A prompt is
//   "won"    - you are mentioned (in either answer),
//   "missed" - you are not, but at least one competitor is  <- the opportunities,
//   "open"   - nobody is mentioned.

export const MODES = { web: 'Web search answer', llm: 'AI model answer' };

const mentionedAny = (m) => !!(m && (m.web || m.llm));
const mentionedBoth = (m) => !!(m && m.web && m.llm);
const round1 = (v) => parseFloat(v.toFixed(1));

export const flatten = (matrix) => (matrix?.clusters || []).flatMap(c => c.prompts.map(p => ({ ...p, cluster: c.cluster })));

// Classify every prompt and rank the missed ones by how much is at stake.
export const analyse = (matrix) => {
  const entities = matrix?.entities || [];
  const brand = entities[0]?.name;
  const rivals = entities.slice(1).map(e => e.name);
  const prompts = flatten(matrix);

  // per cluster: how often you / each rival is mentioned -> where you are weak
  const clusterStats = (matrix?.clusters || []).map((c) => {
    const youCount = c.prompts.filter(p => mentionedAny(p.mentions[brand])).length;
    const rivalCounts = rivals.map(r => ({ name: r, count: c.prompts.filter(p => mentionedAny(p.mentions[r])).length }));
    const best = rivalCounts.reduce((a, b) => (b.count > a.count ? b : a), { name: null, count: 0 });
    const total = c.prompts.length;
    return {
      cluster: c.cluster, total, youCount, youRate: total ? youCount / total : 0,
      bestRival: best.count ? best.name : null, bestRivalCount: best.count, bestRivalRate: total ? best.count / total : 0,
    };
  });
  const weakness = Object.fromEntries(clusterStats.map(c => [c.cluster, 1 - c.youRate]));

  const classified = prompts.map((p) => {
    const you = p.mentions[brand] || { web: false, llm: false };
    const winners = rivals
      .filter(r => mentionedAny(p.mentions[r]))
      .map(r => ({ name: r, web: !!p.mentions[r].web, llm: !!p.mentions[r].llm, both: mentionedBoth(p.mentions[r]) }));
    const status = mentionedAny(you) ? 'won' : winners.length ? 'missed' : 'open';
    // transparent ranking: more rivals, rivals that win in both modes, and a cluster where you are weak all raise it
    const score = round1(winners.length * 2 + winners.filter(w => w.both).length + (weakness[p.cluster] || 0) * 2);
    return { ...p, you, winners, status, score };
  });

  const count = (fn) => classified.filter(fn).length;
  const total = classified.length;
  const rivalBoard = rivals.map(r => ({
    name: r, kind: entities.find(e => e.name === r)?.kind,
    prompts: count(p => mentionedAny(p.mentions[r])),
    whereYouMissed: count(p => p.status === 'missed' && mentionedAny(p.mentions[r])),
  })).sort((a, b) => b.prompts - a.prompts);

  return {
    brand, rivals, total, classified, clusterStats, rivalBoard,
    won: classified.filter(p => p.status === 'won'),
    missed: classified.filter(p => p.status === 'missed').sort((a, b) => b.score - a.score),
    open: classified.filter(p => p.status === 'open'),
    rate: { any: total ? count(p => p.status === 'won') / total : 0, web: total ? count(p => p.you.web) / total : 0, llm: total ? count(p => p.you.llm) / total : 0 },
  };
};

// Why is this prompt ranked where it is? (shown to the user, so the ranking is never a black box)
export const reasons = (p, clusterStats) => {
  const out = [];
  if (p.winners.length) out.push(`${p.winners.length} competitor${p.winners.length > 1 ? 's' : ''} recommended`);
  const both = p.winners.filter(w => w.both).length;
  if (both) out.push(`${both} named in both answers`);
  const c = clusterStats.find(x => x.cluster === p.cluster);
  if (c && c.youRate < 0.5) out.push(`you appear in only ${c.youCount} of ${c.total} "${p.cluster}" prompts`);
  return out;
};

// Split a text into plain / highlighted parts for the given names (best effort, case-insensitive).
export const highlightParts = (text, names) => {
  const list = [...new Set((names || []).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!text || !list.length) return [{ text: text || '', hit: null }];
  const escaped = list.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text.split(re).filter(part => part !== '').map((part) => {
    const hit = list.find(n => n.toLowerCase() === part.toLowerCase());
    return { text: part, hit: hit || null };
  });
};

export const pct = (v) => `${Math.round(v * 100)}%`;
