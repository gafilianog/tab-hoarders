import { describe, expect, it } from 'vitest';
import { addFolder, addItem, createEmptyTree, setExpanded } from './tree';
import { ROOT_ID, type NodeId, type Tree } from './types';
import { listVisibleRows, treeKeyAction } from './visible-rows';

const T0 = 1_700_000_000_000;

/**
 * root
 * ├─ a/        (expanded)
 * │  ├─ a1
 * │  └─ b/     (collapsed)
 * │     └─ b1
 * ├─ e/        (expanded, empty)
 * └─ r1
 */
function sample(): Tree {
  let tree = createEmptyTree(T0);
  const folder = (parentId: NodeId, id: string) => {
    tree = addFolder(tree, parentId, { id, name: id, createdAt: T0 });
  };
  const item = (parentId: NodeId, id: string) => {
    tree = addItem(tree, parentId, { id, url: `https://example.com/${id}`, title: id, createdAt: T0 });
  };
  folder(ROOT_ID, 'a');
  item('a', 'a1');
  folder('a', 'b');
  item('b', 'b1');
  tree = setExpanded(tree, 'b', false);
  folder(ROOT_ID, 'e');
  item(ROOT_ID, 'r1');
  return tree;
}

describe('listVisibleRows', () => {
  it('lists rows top to bottom, skipping the contents of collapsed folders', () => {
    const rows = listVisibleRows(sample()).map((row) => [row.node.id, row.depth, row.position, row.siblingCount]);
    expect(rows).toEqual([
      ['a', 0, 1, 3],
      ['a1', 1, 1, 2],
      ['b', 1, 2, 2],
      ['e', 0, 2, 3],
      ['r1', 0, 3, 3],
    ]);
  });

  it('shows the contents once a folder is expanded', () => {
    const ids = listVisibleRows(setExpanded(sample(), 'b', true)).map((row) => row.node.id);
    expect(ids).toEqual(['a', 'a1', 'b', 'b1', 'e', 'r1']);
  });

  it('is empty for an empty tree', () => {
    expect(listVisibleRows(createEmptyTree(T0))).toEqual([]);
  });
});

describe('treeKeyAction (FR-43)', () => {
  const rows = listVisibleRows(sample());
  const key = (focusedId: NodeId, pressed: string) => treeKeyAction(rows, focusedId, pressed);

  it('moves up and down, stopping at the ends', () => {
    expect(key('a', 'ArrowDown')).toEqual({ type: 'focus', id: 'a1' });
    expect(key('a1', 'ArrowUp')).toEqual({ type: 'focus', id: 'a' });
    expect(key('a', 'ArrowUp')).toEqual({ type: 'none' });
    expect(key('r1', 'ArrowDown')).toEqual({ type: 'none' });
  });

  it('jumps to the first and last row', () => {
    expect(key('b', 'Home')).toEqual({ type: 'focus', id: 'a' });
    expect(key('b', 'End')).toEqual({ type: 'focus', id: 'r1' });
    expect(key('a', 'Home')).toEqual({ type: 'none' });
  });

  it('Right opens a closed folder, then moves into it', () => {
    expect(key('b', 'ArrowRight')).toEqual({ type: 'expand', id: 'b' });
    expect(key('a', 'ArrowRight')).toEqual({ type: 'focus', id: 'a1' });
  });

  it('Right does nothing on a page or an open empty folder', () => {
    expect(key('a1', 'ArrowRight')).toEqual({ type: 'none' });
    expect(key('e', 'ArrowRight')).toEqual({ type: 'none' });
  });

  it('Left closes an open folder, otherwise moves to the folder above', () => {
    expect(key('a', 'ArrowLeft')).toEqual({ type: 'collapse', id: 'a' });
    expect(key('a1', 'ArrowLeft')).toEqual({ type: 'focus', id: 'a' });
    expect(key('b', 'ArrowLeft')).toEqual({ type: 'focus', id: 'a' });
  });

  it('Left does nothing on a closed top-level folder or a top-level page', () => {
    const collapsed = listVisibleRows(setExpanded(sample(), 'a', false));
    expect(treeKeyAction(collapsed, 'a', 'ArrowLeft')).toEqual({ type: 'none' });
    expect(key('r1', 'ArrowLeft')).toEqual({ type: 'none' });
  });

  it('ignores other keys and unknown rows', () => {
    expect(key('a', 'x')).toEqual({ type: 'none' });
    expect(key('ghost', 'ArrowDown')).toEqual({ type: 'none' });
  });
});
