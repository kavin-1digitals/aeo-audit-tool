import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PromptsLab from '../PromptsLab';
import * as api from '../../../services/api';
import { analyse, highlightParts, reasons } from './utils';

jest.mock('../../../services/api', () => ({ getRunPrompts: jest.fn() }));

const m = (web, llm) => ({ web, llm });
const prompt = (index, text, answers, mentions) => ({ index, prompt: text, web_answer: answers[0], llm_answer: answers[1], mentions });

// Alo (you), Nike, Gap. Cluster "pants": Alo wins p0; Nike+Gap win p1 (Nike in both); nobody in p2.
// Cluster "shoes": Nike wins p3 and p4, Alo missing.
const matrix = {
  run_id: 'r1', available: true, prompt_count: 5,
  entities: [{ name: 'Alo', kind: 'brand' }, { name: 'Nike', kind: 'discovered' }, { name: 'Gap', kind: 'added' }],
  clusters: [
    { cluster: 'pants', prompts: [
      prompt(0, 'best yoga pants', ['Alo and Nike are great', 'Alo only'], { Alo: m(true, true), Nike: m(true, false), Gap: m(false, false) }),
      prompt(1, 'cheap leggings', ['Nike and Gap', 'Nike again'], { Alo: m(false, false), Nike: m(true, true), Gap: m(true, false) }),
      prompt(2, 'sustainable fabric', ['none', 'none'], { Alo: m(false, false), Nike: m(false, false), Gap: m(false, false) }),
    ] },
    { cluster: 'shoes', prompts: [
      prompt(3, 'best running shoes', ['Nike', 'Nike'], { Alo: m(false, false), Nike: m(true, true), Gap: m(false, false) }),
      prompt(4, 'trail shoes', ['Nike', 'nothing'], { Alo: m(false, false), Nike: m(true, false), Gap: m(false, false) }),
    ] },
  ],
};

describe('prompt analysis', () => {
  const a = analyse(matrix);

  test('classifies prompts and rates', () => {
    expect([a.won.length, a.missed.length, a.open.length, a.total]).toEqual([1, 3, 1, 5]);
    expect(a.rate.any).toBeCloseTo(0.2); expect(a.rate.web).toBeCloseTo(0.2); expect(a.rate.llm).toBeCloseTo(0.2);
  });

  test('missed prompts are ranked: more rivals, both-mode wins and weak clusters first', () => {
    // p1: 2 rivals*2 + 1 both + (pants weakness 1-1/3)*2 = 4+1+1.3=6.3 ; p3: 1*2+1+ (shoes weakness 1)*2 = 5 ; p4: 2+0+2 = 4
    expect(a.missed.map(p => p.index)).toEqual([1, 3, 4]);
    expect(a.missed[0].score).toBe(6.3);
    expect(a.missed[0].winners.map(w => [w.name, w.both])).toEqual([['Nike', true], ['Gap', false]]);
  });

  test('cluster stats, rival board and transparent reasons', () => {
    const shoes = a.clusterStats.find(c => c.cluster === 'shoes');
    expect(shoes).toMatchObject({ youCount: 0, bestRival: 'Nike', bestRivalCount: 2 });
    expect(a.rivalBoard[0]).toMatchObject({ name: 'Nike', prompts: 4, whereYouMissed: 3 });
    expect(reasons(a.missed[0], a.clusterStats)).toEqual(['2 competitors recommended', '1 named in both answers', 'you appear in only 1 of 3 "pants" prompts']);
  });

  test('highlighting finds names case-insensitively, longest first', () => {
    expect(highlightParts('Alo Yoga beats nike here', ['Alo', 'Alo Yoga', 'Nike']).map(p => [p.text, p.hit])).toEqual([
      ['Alo Yoga', 'Alo Yoga'], [' beats ', null], ['nike', 'Nike'], [' here', null]]);
    expect(highlightParts('plain', [])).toEqual([{ text: 'plain', hit: null }]);
    expect(highlightParts('a (b) c', ['(b)'])[1].hit).toBe('(b)'); // regex characters are escaped
  });
});

describe('Prompts Lab tab', () => {
  const props = { auditData: { audit_metadata: { run_id: 'r1', brand: 'Alo' } } };

  test('shows the flow: standing, ranked opportunities with answers, wins, explorer', async () => {
    api.getRunPrompts.mockResolvedValue(matrix);
    render(<PromptsLab {...props} />);
    await waitFor(() => screen.getByRole('heading', { name: 'Where you stand' }));

    expect(screen.getByText(/5 questions your customers might ask AI/)).toBeInTheDocument();
    expect(screen.getByText('Competitors win, not you')).toBeInTheDocument();
    ['Missed opportunities', 'Where you are recommended', 'Every prompt'].forEach(t => expect(screen.getByRole('heading', { name: t })).toBeInTheDocument());

    // top opportunity first, with the reason and an answer that can be opened
    const cards = screen.getAllByRole('listitem').filter(li => li.textContent.includes('Ranked high because'));
    expect(within(cards[0]).getByText('cheap leggings')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/Ranked high because: 2 competitors recommended/)).toBeInTheDocument();
    fireEvent.click(within(cards[0]).getByText(/See what AI answered/));
    expect(within(cards[0]).getByText('Nike', { selector: 'mark' })).toBeInTheDocument();

    // wins are collapsed until asked for
    expect(screen.queryByText('best yoga pants', { selector: 'li p' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Show 1 prompt/));
    expect(screen.getAllByText('best yoga pants').length).toBeGreaterThan(0);
  });

  test('filters opportunities by competitor', async () => {
    api.getRunPrompts.mockResolvedValue(matrix);
    render(<PromptsLab {...props} />);
    await waitFor(() => screen.getByRole('heading', { name: 'Missed opportunities' }));
    fireEvent.change(screen.getByDisplayValue('All competitors'), { target: { value: 'Gap' } });
    expect(screen.getByText(/1 of 3 missed prompts/)).toBeInTheDocument();
  });

  test('explains instead of failing when there is nothing to show', async () => {
    api.getRunPrompts.mockResolvedValue({ run_id: 'r1', available: false, entities: [], clusters: [], prompt_count: 0 });
    render(<PromptsLab {...props} />);
    await waitFor(() => expect(screen.getByText('No prompt data for this audit')).toBeInTheDocument());
    render(<PromptsLab auditData={{ audit_metadata: { brand: 'Alo' } }} />);
    expect(screen.getByText('Prompts Lab needs a stored audit')).toBeInTheDocument();
  });
});
