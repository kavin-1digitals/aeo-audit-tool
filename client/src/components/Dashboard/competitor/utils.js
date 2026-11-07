import { signalLabel } from '../../../utils/signalLabels';

// Pure helpers for the Competitor tab (no React). The tab tells one story:
//   1. how much of the website checklist could be completed for each site, and how it scored on that part,
//   2. where the score comes from, per category (Domain Signals, Site Signals, LLM Brand Analysis),
//   3. which brands AI names in its answers,
//   4. the raw facts and every single signal, on demand.
// A signal that could not be checked (blocked, site not crawlable) carries no weight: it is "not checked", never a failure.

export const LLM_SIGNALS = new Set(['cluster_presence', 'cluster_dominance', 'prompt_citation']);

export const SITE_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];
export const BRAND_COLOR = '#3B82F6';

export const CATEGORIES = [
  { key: 'domain_signals', label: 'Domain Signals', blurb: 'robots.txt, llms.txt, sitemap and AI / search crawler access' },
  { key: 'site_signals', label: 'Site Signals', blurb: 'crawlability, canonical tags, structured data (JSON-LD) and meta tags' },
];

// LLM Brand Analysis is the audit's third category. Every brand is scored on the same stored questions, so it is
// always fully "checked" and directly comparable (unlike the website checks, which a site can block).
export const AI_CATEGORY = {
  key: 'ai_visibility', label: 'LLM Brand Analysis',
  blurb: 'whether AI names the brand when it answers the same customer questions',
};

export const aiCategoryFrom = (ai) => {
  if (!ai) return null;
  const passed = ai.signals.reduce((n, sg) => n + sg.passed, 0);
  const checks = ai.signals.reduce((n, sg) => n + sg.total, 0);
  return { ...AI_CATEGORY, earned: ai.earned, analysed: ai.full, full: ai.full, score_pct: ai.score_pct, coverage_pct: 100, passed, failed: checks - passed, checks, signals: ai.signals };
};

export const humanize = signalLabel;
const pct1 = (part, whole) => (whole ? parseFloat(((part / whole) * 100).toFixed(1)) : null);
const round1 = (v) => parseFloat((v || 0).toFixed(1));
export const fmtPts = (v) => (v == null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(1));

// green / amber / red by how well something scored
export const level = (pct) => (pct == null
  ? { text: 'text-gray-400', bar: 'bg-gray-300' }
  : pct >= 75 ? { text: 'text-green-600', bar: 'bg-green-500' }
    : pct >= 50 ? { text: 'text-amber-600', bar: 'bg-amber-500' } : { text: 'text-red-600', bar: 'bg-red-500' });

// ---- audit summary (mirror of server/src/services/technical_summary.py) -------------------------------------
export const confidenceFor = (coveragePct) => {
  if (coveragePct == null) return 'limited';
  return coveragePct >= 80 ? 'full' : coveragePct >= 40 ? 'partial' : 'limited';
};

export const STATUS = {
  full: { label: 'Fully assessed', cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partly assessed', cls: 'bg-amber-100 text-amber-800' },
  limited: { label: 'Mostly not checked', cls: 'bg-red-100 text-red-700' },
};

export const summarize = (categoryScores) => {
  if (!categoryScores) return null;
  const totals = { earned: 0, analysed: 0, full: 0, passed: 0, failed: 0 };
  const categories = CATEGORIES.filter(c => categoryScores[c.key]).map((def) => {
    const c = categoryScores[def.key];
    const earned = c.total_weightage_percentage || 0;
    const analysed = c.max_possible_total_weightage_percentage || 0;
    const full = (c.signals || []).reduce((sum, sg) => sum + (sg.weightage_percentage || 0), 0);
    const passed = c.positive_checks || 0;
    const failed = c.negative_checks || 0;
    totals.earned += earned; totals.analysed += analysed; totals.full += full; totals.passed += passed; totals.failed += failed;
    return {
      key: def.key, label: def.label, earned: round1(earned), analysed: round1(analysed), full: round1(full),
      score_pct: pct1(earned, analysed), coverage_pct: pct1(analysed, full), passed, failed, checks: passed + failed,
    };
  });
  if (!categories.length) return null;
  const coverage = pct1(totals.analysed, totals.full);
  return {
    earned: round1(totals.earned), analysed: round1(totals.analysed), full: round1(totals.full),
    score_pct: pct1(totals.earned, totals.analysed), coverage_pct: coverage,
    passed: totals.passed, failed: totals.failed, checks: totals.passed + totals.failed,
    confidence: confidenceFor(coverage), categories,
  };
};

// ---- per-signal index: weight, whether it could be checked, how much it earned ----------------------------
export const signalIndex = (categoryScores) => {
  const map = new Map();
  CATEGORIES.forEach(({ key }) => {
    (categoryScores?.[key]?.signals || []).forEach((s) => {
      const weight = s.weightage_percentage || 0;
      const assessed = (s.max_possible_weightage_percentage || 0) > 0 && (s.total_checks || 0) > 0;
      const earned = s.total_weightage_percentage || 0;
      map.set(s.signal_name, {
        category: key, weight, assessed, earned,
        frac: assessed && weight ? earned / weight : null,
        passed: s.positive_checks || 0, total: s.total_checks || 0,
      });
    });
  });
  return map;
};

// signal_name -> pass-rate over individual checks (used by the detailed matrix)
export const passRates = (scores = []) => {
  const map = new Map();
  scores.forEach((s) => {
    if (LLM_SIGNALS.has(s.signal_name)) return;
    const entry = map.get(s.signal_name) || { passed: 0, total: 0, group: s.signal_path?.[0] || 'Other' };
    entry.total += 1;
    if (s.value > 0) entry.passed += 1;
    map.set(s.signal_name, entry);
  });
  map.forEach((e) => { e.rate = e.total ? e.passed / e.total : 0; });
  return map;
};

export const signalRows = (sites) => {
  const rows = new Map();
  sites.forEach((site) => site.rates.forEach((info, name) => {
    if (!rows.has(name)) rows.set(name, { name, group: info.group });
  }));
  const groups = {};
  rows.forEach((r) => { (groups[r.group] = groups[r.group] || []).push(r); });
  return groups;
};

// ---- domain-level facts ------------------------------------------------------------------------------------
const HTTP_NOTE = (f) => (f?.http ? ` (HTTP ${f.http})` : '');
export const factLabel = (key, facts) => {
  const f = facts?.[key];
  if (!f) return { text: '—', tone: 'muted' };
  const pick = (table) => table[f.state] || { text: '—', tone: 'muted' };
  if (key === 'robots') {
    return pick({ ok: { text: 'Found', tone: 'good' }, missing: { text: 'Missing', tone: 'bad' },
      blocked: { text: `Blocked${HTTP_NOTE(f)}`, tone: 'warn' }, unknown: { text: 'Unknown', tone: 'muted' } });
  }
  if (key === 'llms_txt') {
    return pick({ ok: { text: 'Valid', tone: 'good' }, present_invalid: { text: 'Found, invalid', tone: 'warn' },
      missing: { text: 'Missing', tone: 'bad' }, blocked: { text: `Blocked${HTTP_NOTE(f)}`, tone: 'warn' },
      unknown: { text: 'Unknown', tone: 'muted' } });
  }
  if (key === 'sitemap') {
    return pick({ ok: { text: f.type ? `Found · ${f.type}` : 'Found', tone: 'good' }, missing: { text: 'Missing', tone: 'bad' },
      blocked: { text: `Blocked${HTTP_NOTE(f)}`, tone: 'warn' }, unknown: { text: 'Unknown', tone: 'muted' } });
  }
  if (key === 'ai_crawlers' || key === 'search_crawlers') {
    const tone = f.allowed === f.total ? 'good' : f.allowed === 0 ? 'bad' : 'warn';
    return { text: `${f.allowed} of ${f.total} allowed`, tone, title: f.blocked_agents?.length ? `Restricted: ${f.blocked_agents.join(', ')}` : undefined };
  }
  return { text: '—', tone: 'muted' };
};

// Plain-language reason why a site could not be assessed fully (or null).
export const limitationNote = (site) => {
  if (site.confidence === 'full') return null;
  const f = site.facts || {};
  const names = { robots: 'robots.txt', llms_txt: 'llms.txt', sitemap: 'the sitemap' };
  const blocked = Object.keys(names).filter(k => f[k]?.state === 'blocked').map(k => names[k]);
  if (f.site && f.site.scrapable === false) blocked.push('its pages');
  const http = f.robots?.http || f.llms_txt?.http;
  if (blocked.length || f.blocked_by_protection) {
    return `${blocked.length ? blocked.join(', ') : 'The site'} could not be read${http ? ` (HTTP ${http})` : ''}${f.blocked_by_protection ? ' – the site uses bot protection' : ''}. `
      + 'Those checks are left out rather than counted as failures.';
  }
  return site.confidence === 'limited' ? 'Too few checks could be run on this site to judge it.' : 'Some checks could not be run on this site.';
};

// ---- sites ---------------------------------------------------------------------------------------------------
export const brandTechnical = (overview, auditData) => {
  const snap = overview?.brand?.technical;
  if (snap && (snap.scores?.length || snap.category_scores)) return snap;
  return {
    category_scores: auditData?.scorecard?.category_scores,
    scores: auditData?.raw_scorecard?.scores || [],
    site_scrapable: true,
  };
};

const siteFrom = ({ id, name, domain, isBrand, color, technical, visibility, ai, extra = {} }) => {
  const summary = technical?.summary || summarize(technical?.category_scores);
  const confidence = summary?.confidence || 'limited';
  const score = summary?.score_pct ?? null;
  return {
    id, name, domain, isBrand, color, summary, confidence,
    coveragePct: summary?.coverage_pct ?? null,
    scorePct: score,
    rated: score != null && confidence !== 'limited', // limited data: shown, but not rated or compared
    signals: signalIndex(technical?.category_scores),
    rates: passRates(technical?.scores || []),
    facts: technical?.facts || {},
    pages: technical?.pages_analysed ?? technical?.facts?.site?.pages_analysed ?? null,
    scrapable: technical?.site_scrapable !== false,
    visibility,
    ai: aiCategoryFrom(ai),
    ...extra,
  };
};

export const buildSites = (overview, auditData) => {
  const technical = brandTechnical(overview, auditData);
  const sites = [siteFrom({
    id: 'brand', name: overview?.brand?.name || auditData?.audit_metadata?.brand || 'Your brand',
    domain: overview?.brand?.domain, isBrand: true, color: BRAND_COLOR, technical, visibility: overview?.brand?.visibility,
    ai: overview?.brand?.ai,
  })];
  (overview?.entries || []).filter(e => e.status === 'done' && e.technical).forEach((e, i) => {
    sites.push(siteFrom({
      id: e.comparison_id, name: e.name, domain: e.domain, isBrand: false, color: SITE_COLORS[i % SITE_COLORS.length],
      technical: e.technical, visibility: e.visibility, ai: e.ai,
      extra: { reused: e.reused_snapshot, takenAt: e.technical.taken_at, requestedUrl: e.requested_url },
    }));
  });
  return sites;
};
