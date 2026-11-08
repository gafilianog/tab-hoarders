import { describe, expect, it } from 'vitest';
import { collectItems, countDescendants, moveNode } from '../tree/tree';
import { ROOT_ID } from '../tree/types';
import { parseTree } from '../tree/validate';
import { listVisibleRows } from '../tree/visible-rows';
import { buildLargeSampleTree } from './large-sample-tree';

const tree = buildLargeSampleTree(0);

function timeMs(fn: () => unknown): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe('buildLargeSampleTree', () => {
  it('has 100 folders and 1,000 pages, and is valid', () => {
    expect(countDescendants(tree, ROOT_ID)).toEqual({ folders: 100, items: 1000 });
    expect(parseTree(tree).ok).toBe(true);
    expect(listVisibleRows(tree)).toHaveLength(1100);
  });
});

// Loose budgets: these take well under a millisecond on a laptop. The test
// only fails if one becomes dramatically slower, not on normal noise.
describe('tree operations at the NFR-1 size', () => {
  it.each([
    ['validating the stored tree', () => parseTree(tree)],
    ['listing the visible rows', () => listVisibleRows(tree)],
    ['moving a page', () => moveNode(tree, 'large-item-1', 'large-folder-10-9')],
    ['collecting every page for Open all', () => collectItems(tree, ROOT_ID)],
    ['serializing for storage', () => JSON.stringify(tree)],
  ])('%s takes under 50 ms', (_name, operation) => {
    expect(timeMs(operation)).toBeLessThan(50);
  });

  it('stores in well under the 10 MB storage quota', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(tree)).length;
    expect(bytes).toBeLessThan(1_000_000);
  });
});
