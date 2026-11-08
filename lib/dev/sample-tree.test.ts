import { describe, expect, it } from 'vitest';
import { collectItems, getNode } from '../tree/tree';
import { ROOT_ID } from '../tree/types';
import { parseTree } from '../tree/validate';
import { buildSampleTree } from './sample-tree';

describe('buildSampleTree', () => {
  it('builds a tree the storage validator accepts', () => {
    expect(parseTree(buildSampleTree(0)).ok).toBe(true);
  });

  it('contains an item 20 folders deep', () => {
    const tree = buildSampleTree(0);
    const depths = collectItems(tree, ROOT_ID).map((item) => {
      let depth = 0;
      let parentId = item.parentId;
      while (parentId !== ROOT_ID) {
        depth += 1;
        parentId = getNode(tree, parentId).parentId ?? ROOT_ID;
      }
      return depth;
    });
    expect(Math.max(...depths)).toBe(20);
  });

  it('starts with at least one folder collapsed', () => {
    const tree = buildSampleTree(0);
    const collapsed = Object.values(tree.nodes).filter((node) => node.type === 'folder' && !node.expanded);
    expect(collapsed.length).toBeGreaterThan(0);
  });
});
