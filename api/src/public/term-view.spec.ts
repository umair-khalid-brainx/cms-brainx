import { mergeRelated, pageCount, parsePage } from './term-view.js';

describe('parsePage (TAX-02)', () => {
  it('takes no page as the first', () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage('')).toBe(1);
  });

  it('reads a whole number from 1 up', () => {
    expect(parsePage('1')).toBe(1);
    expect(parsePage('12')).toBe(12);
  });

  it.each(['0', '-1', '2.5', 'abc', '1e3', ' 2', '02', '99999999'])('refuses %j', (raw) => {
    expect(parsePage(raw)).toBeNull();
  });
});

describe('pageCount', () => {
  it('is at least one page, even with nothing in it', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(20, 20)).toBe(1);
    expect(pageCount(21, 20)).toBe(2);
  });
});

describe('mergeRelated (TAX-02)', () => {
  const row = (id: string) => ({ id });

  it('puts category matches first, then fills from tag matches, nobody twice', () => {
    const merged = mergeRelated([row('c1'), row('c2')], [row('c2'), row('t1'), row('t2')]);
    expect(merged.map((r) => r.id)).toEqual(['c1', 'c2', 't1']);
  });

  it('never goes over three, and ignores tags when categories already fill it', () => {
    expect(mergeRelated([row('c1'), row('c2'), row('c3'), row('c4')], [row('t1')]).map((r) => r.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('is empty with nothing', () => {
    expect(mergeRelated([], [])).toEqual([]);
  });
});
