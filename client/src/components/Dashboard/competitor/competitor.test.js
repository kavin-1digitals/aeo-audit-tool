import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CompetitorAudit from '../CompetitorAudit';
import * as api from '../../../services/api';
import {
  buildSites, limitationNote, signalIndex, summarize,
} from './utils';

// recharts' ResponsiveContainer needs ResizeObserver, which jsdom does not provide
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

jest.mock('../../../services/api', () => ({
  getCompetitors: jest.fn(), addCompetitor: jest.fn(), removeCompetitor: jest.fn(), carryOverCompetitors: jest.fn(),
}));

// category_scores in the shape the backend sends: signals carry weight, whether they were checked, and what they earned
const sig = (name, weight, checks, passed) => ({
  signal_name: name, weightage_percentage: weight, total_checks: checks, positive_checks: passed, negative_checks: checks - passed,
  max_possible_weightage_percentage: checks ? weight : 0, total_weightage_percentage: checks ? (weight * passed) / checks : 0,
});
const category = (signals) => ({
  signals,
  total_weightage_percentage: signals.reduce((s, x) => s + x.total_weightage_percentage, 0),
  max_possible_total_weightage_percentage: signals.reduce((s, x) => s + x.max_possible_weightage_percentage, 0),
  positive_checks: signals.reduce((s, x) => s + x.positive_checks, 0),
  negative_checks: signals.reduce((s, x) => s + x.negative_checks, 0),
});
const scores = (domain, site) => ({ domain_signals: category(domain), site_signals: category(site) });

// You: everything checked. Good Co: everything checked. Blocked Co: only sitemap + scrapability checked (both failed).
const DOMAIN = ['llms_txt_exists', 'robots_txt_exists', 'sitemap_exists', 'ai_crawler_access'];
const SITE = ['site_scrapable', 'canonical_exists', 'jsonld_exists', 'og_tags_exists'];
const full = (names, weight, passedMap) => names.map(n => sig(n, weight, 1, passedMap[n] ? 1 : 0));

const youScores = scores(full(DOMAIN, 7.5, { robots_txt_exists: 1, sitemap_exists: 1, ai_crawler_access: 1 }), full(SITE, 7.5, { site_scrapable: 1, canonical_exists: 1, jsonld_exists: 1 }));
const goodScores = scores(full(DOMAIN, 7.5, { llms_txt_exists: 1, robots_txt_exists: 1, sitemap_exists: 1, ai_crawler_access: 1 }), full(SITE, 7.5, { site_scrapable: 1, canonical_exists: 1, jsonld_exists: 1, og_tags_exists: 1 }));
const blockedScores = scores(
  DOMAIN.map(n => sig(n, 7.5, n === 'sitemap_exists' ? 1 : 0, 0)),
  SITE.map(n => sig(n, 7.5, n === 'site_scrapable' ? 1 : 0, 0)),
);

const aiOf = (p, d, c) => ({
  earned: +(12 * p[0] / p[1] + 12 * d[0] / d[1] + 16 * c[0] / c[1]).toFixed(1), full: 40,
  score_pct: +(((12 * p[0] / p[1] + 12 * d[0] / d[1] + 16 * c[0] / c[1]) / 40) * 100).toFixed(1),
  signals: [
    { signal_name: 'cluster_presence', label: 'Mentioned at least once in the topic', weight: 12, passed: p[0], total: p[1] },
    { signal_name: 'cluster_dominance', label: 'Mentioned at least as often as every other brand in the topic', weight: 12, passed: d[0], total: d[1] },
    { signal_name: 'prompt_citation', label: 'Mentioned in the individual prompt', weight: 16, passed: c[0], total: c[1] },
  ],
});

const overview = {
  run_id: 'r1', limit: 5, visibility_available: true, carry_over: null,
  options: [{ name: 'Nike', source: 'llm_discovered', added: false }],
  brand: { name: 'Alo', domain: 'alo.com', percentage: 70, ai: aiOf([2, 3], [1, 3], [3, 5]), technical: { category_scores: youScores, scores: [], site_scrapable: true, facts: {} }, visibility: { entity: 'Alo', sov: 20, citations: 4, cluster_coverage: 60 } },
  visibility_summary: {
    total_prompts: 10, topics: 2,
    entities: [
      { name: 'Alo', kind: 'brand', citations: 6, web: 5, llm: 4 },
      { name: 'Good Co', kind: 'added', citations: 8, web: 7, llm: 6 },
    ],
    clusters: [
      { cluster: 'pants', prompts: 6, counts: { Alo: 4, 'Good Co': 5 } },
      { cluster: 'shoes', prompts: 4, counts: { Alo: 2, 'Good Co': 3 } },
    ],
  },
  visibility_set: [
    { entity: 'Alo', kind: 'brand', sov: 20, citations: 4, cluster_coverage: 60 },
    { entity: 'Good Co', kind: 'added', sov: 35, citations: 7, cluster_coverage: 80 },
  ],
  entries: [
    { comparison_id: 'c1', name: 'Good Co', domain: 'good.com', requested_url: 'https://good.com', status: 'done', ai: aiOf([3, 3], [2, 3], [5, 5]), technical: { category_scores: goodScores, scores: [], site_scrapable: true, facts: {} }, visibility: { sov: 35 } },
    { comparison_id: 'c2', name: 'Blocked Co', domain: 'blocked.com', requested_url: 'https://blocked.com', status: 'done',
      technical: { category_scores: blockedScores, scores: [], site_scrapable: false, facts: { robots: { state: 'blocked', http: 403 }, site: { scrapable: false, pages_analysed: 0 }, blocked_by_protection: true } } },
  ],
};

describe('comparison logic', () => {
  const sites = buildSites(overview, {});
  const [you, good, blocked] = sites;

  test('blocked site: tiny share checked, not rated, explained', () => {
    expect(blocked.summary.analysed).toBe(15);
    expect(blocked.summary.full).toBe(60);
    expect(blocked.coveragePct).toBe(25);
    expect(blocked.confidence).toBe('limited');
    expect(blocked.rated).toBe(false);
    expect(limitationNote(blocked)).toMatch(/robots\.txt.*HTTP 403.*bot protection.*left out/);
    expect(you.rated && good.rated).toBe(true);
    expect(you.coveragePct).toBe(100);
  });

  test('signal index tells "not checked" from "failed"', () => {
    const idx = signalIndex(blockedScores);
    expect(idx.get('robots_txt_exists').assessed).toBe(false);
    expect(idx.get('sitemap_exists')).toMatchObject({ assessed: true, earned: 0 });
  });
});

describe('LLM Brand Analysis category', () => {
  test('is attached to every site that has it and counted like the other categories', () => {
    const [you, good, blocked] = buildSites(overview, {});
    expect(you.ai).toMatchObject({ key: 'ai_visibility', label: 'LLM Brand Analysis', earned: 21.6, analysed: 40, full: 40, score_pct: 54, coverage_pct: 100, passed: 6, checks: 11 });
    expect(good.ai.score_pct).toBeGreaterThan(you.ai.score_pct);
    expect(blocked.ai).toBeNull(); // not scored (no data in the fixture) - handled as "not checked"
  });
});

describe('Competitor tab', () => {
  beforeEach(() => {
    api.getCompetitors.mockResolvedValue(overview);
  });

  test('tells the story in four steps and does not hide blocked sites behind a 0%', async () => {
    render(<CompetitorAudit auditData={{ audit_metadata: { run_id: 'r1', brand: 'Alo' } }} />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument());

    ['Score by category', 'Who AI assistants mention', 'Details']
      .forEach(t => expect(screen.getByRole('heading', { name: t })).toBeInTheDocument());
    // the head-to-head and "what explains the gap" steps are gone
    expect(screen.queryByRole('heading', { name: 'A fair head-to-head' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'What explains the gap' })).not.toBeInTheDocument();

    // overview: audit completed first, then the score on what was checked
    expect(screen.getAllByText('Audit completed').length).toBeGreaterThan(0);
    expect(screen.getByText('Score on what was checked')).toBeInTheDocument();
    expect(screen.getByText('Not rated')).toBeInTheDocument();
    expect(screen.getByText(/15 of 60 points checked/)).toBeInTheDocument();
    expect(screen.getByText(/could not be read \(HTTP 403\)/)).toBeInTheDocument();
    expect(screen.getByText(/You rank #2 of 2 rated sites/)).toBeInTheDocument();

    // step 2: one row per category (named as on the dashboard), one column per brand, score shown in every cell
    const step2 = screen.getByRole('heading', { name: 'Score by category' }).closest('section');
    ['Domain Signals', 'Site Signals', 'LLM Brand Analysis'].forEach(t => expect(within(step2).getByRole('heading', { name: t })).toBeInTheDocument());
    const table = within(step2).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent.replace('YOU', '').trim())).toEqual(['Category', 'Alo', 'Good Co', 'Blocked Co']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[2]).getAllByText(/scored/).length).toBe(2);              // LLM row: you + Good Co have a score
    expect(within(rows[2]).getByText('Not checked')).toBeInTheDocument();      // the blocked site has no stored-answer score
    expect(within(rows[0]).getAllByText(/checked 100%/).length).toBe(2);        // Domain row: you + Good Co fully checked
    expect(within(rows[0]).getByText(/checked 25%/)).toBeInTheDocument();      // the blocked site: only a quarter checked
    expect(within(step2).getByText('Cited in the topic')).toBeInTheDocument();           // LLM checks use their full names
    expect(within(step2).getByText('Not outnumbered in the topic')).toBeInTheDocument();
    expect(within(step2).getAllByText(/2\/3 topics cited in/).length).toBeGreaterThan(0);
  });

  test('"Who AI assistants mention" goes from totals, to topics, to the scores', async () => {
    render(<CompetitorAudit auditData={{ audit_metadata: { run_id: 'r1', brand: 'Alo' } }} />);
    await waitFor(() => screen.getByRole('heading', { name: 'Who AI assistants mention' }));
    const step3 = screen.getByRole('heading', { name: 'Who AI assistants mention' }).closest('section');
    // only brands that are in the comparison - the AI-found competitor in the dropdown (Nike) is not part of it
    expect(within(step3).queryByText('Nike')).not.toBeInTheDocument();

    expect(within(step3).getByText(/AI was asked 10 customer questions across 2 topics/)).toBeInTheDocument();
    const headings = within(step3).getAllByRole('heading', { level: 4 }).map(h => h.textContent);
    expect(headings).toEqual(['Questions asked and times each brand was named', 'Mentions by topic', 'Share among compared brands and topic coverage']);

    // part 1: totals + citations (most cited first)
    expect(within(step3).getByText('questions asked')).toBeInTheDocument();
    expect(within(step3).getByText('8')).toBeInTheDocument();   // Good Co citations
    expect(within(step3).getAllByText(/of 10 questions/).length).toBe(2);
    expect(within(step3).getByText(/Web-search answers: 7 · AI model answers: 6/)).toBeInTheDocument();
    // part 2: per topic counts
    expect(within(step3).getByText('pants')).toBeInTheDocument();
    expect(within(step3).getByText('5 of 6')).toBeInTheDocument();
    expect(within(step3).getByText('2 of 4')).toBeInTheDocument();
    // part 3: share among the compared brands + topic coverage numbers, with topics named
    expect(within(step3).getByText('35%')).toBeInTheDocument();
    expect(within(step3).getAllByText(/\(2 of 2 topics\)/).length).toBe(2);
  });

  test('details stay closed until asked for', async () => {
    render(<CompetitorAudit auditData={{ audit_metadata: { run_id: 'r1', brand: 'Alo' } }} />);
    await waitFor(() => screen.getByRole('heading', { name: 'Details' }));
    expect(screen.queryByText('Search crawlers')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Technical facts/ }));
    expect(screen.getByText('Search crawlers')).toBeInTheDocument();
    expect(within(screen.getByText('Search crawlers').closest('table')).getAllByText(/Blocked/).length).toBeGreaterThan(0);
  });

  test('without a stored run it explains instead of failing', () => {
    render(<CompetitorAudit auditData={{ audit_metadata: { brand: 'Alo' } }} />);
    expect(screen.getByText(/not linked to a stored audit/)).toBeInTheDocument();
  });
});
