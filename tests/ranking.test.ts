import { describe, it, expect } from 'vitest';
import { rankByFit, type Rankable } from '../src/analysis/ranking.js';

const day = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * day);

interface Item { id: string; r: Rankable }
const rank = (items: Item[]) => rankByFit(items, (x) => x.r).map((x) => x.id);

describe('shortlist ranking', () => {
  it('lets fit score dominate over freshness', () => {
    const items: Item[] = [
      { id: 'stale-strong', r: { fitScore: 90, priority: false, datePosted: ago(10), confidence: 'MEDIUM' } },
      { id: 'fresh-weaker', r: { fitScore: 80, priority: true, datePosted: ago(0), confidence: 'HIGH' } },
    ];
    expect(rank(items)[0]).toBe('stale-strong');
  });

  it('uses freshness to break close/equal scores', () => {
    const items: Item[] = [
      { id: 'older', r: { fitScore: 80, priority: false, datePosted: ago(5), confidence: 'MEDIUM' } },
      { id: 'fresh', r: { fitScore: 80, priority: true, datePosted: ago(0), confidence: 'MEDIUM' } },
    ];
    expect(rank(items)[0]).toBe('fresh');
  });

  it('does not lower rank for missing salary (salary is not an input)', () => {
    // Two identical rankables — salary plays no part, so original order is preserved.
    const items: Item[] = [
      { id: 'a', r: { fitScore: 85, priority: true, datePosted: ago(1), confidence: 'HIGH' } },
      { id: 'b', r: { fitScore: 85, priority: true, datePosted: ago(1), confidence: 'HIGH' } },
    ];
    expect(rank(items)).toEqual(['a', 'b']);
  });

  it('gives no boost to a famous company (company is not an input)', () => {
    const items: Item[] = [
      { id: 'famous-lowfit', r: { fitScore: 55, priority: true, datePosted: ago(0), confidence: 'HIGH' } },
      { id: 'unknown-highfit', r: { fitScore: 88, priority: false, datePosted: ago(4), confidence: 'LOW' } },
    ];
    expect(rank(items)[0]).toBe('unknown-highfit');
  });
});
