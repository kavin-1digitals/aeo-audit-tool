import { knownSignals, signalCategory, signalCheck, signalLabel, signalScope } from './signalLabels';

describe('signal names', () => {
  test('are full, readable and unique for all 22 scored signals', () => {
    const names = knownSignals();
    expect(names).toHaveLength(22);
    const labels = names.map(signalLabel);
    expect(new Set(labels).size).toBe(names.length);
    labels.forEach(l => expect(l).not.toMatch(/_/));
    names.forEach(n => { expect(signalCheck(n)).toMatch(/\.$/); expect(signalScope(n)).not.toBe(''); });
  });

  test('misleading identifiers get names that say what is checked', () => {
    expect(signalLabel('llms_txt_exists')).toBe('llms.txt file present');          // not "Llms Txt Exists"
    expect(signalLabel('cluster_dominance')).toBe('Not outnumbered in the topic'); // "dominance" overstated it
    expect(signalLabel('sitemap_type_valid')).toBe('Sitemap structure valid');
    expect(signalLabel('page_indexable')).toBe('Page allowed in search (no noindex)');
    expect(signalCategory('prompt_citation')).toBe('llm_signals');
  });

  test('unknown identifiers still get a readable fallback', () => {
    expect(signalLabel('some_new_check')).toBe('Some New Check');
    expect(signalLabel(undefined)).toBe('');
  });
});
