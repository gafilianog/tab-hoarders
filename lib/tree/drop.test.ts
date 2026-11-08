import { describe, expect, it } from 'vitest';
import { positionInRow, resolveDrop, type DropTarget } from './drop';
import { addFolder, addItem, createEmptyTree, getChildren, moveNode, setExpanded } from './tree';
import { ROOT_ID, type NodeId, type Tree } from './types';
import { parseTree } from './validate';

const T0 = 1_700_000_000_000;

/**
 * root
 * ├─ a/          (expanded)
 * │  ├─ a1
 * │  └─ a2
 * ├─ b/          (collapsed)
 * │  └─ b1
 * ├─ e/          (empty, expanded)
 * ├─ r1
 * └─ r2
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
  item('a', 'a2');
  folder(ROOT_ID, 'b');
  item('b', 'b1');
  tree = setExpanded(tree, 'b', false);
  folder(ROOT_ID, 'e');
  item(ROOT_ID, 'r1');
  item(ROOT_ID, 'r2');
  return tree;
}

const row = (nodeId: NodeId, position: 'before' | 'after' | 'inside'): DropTarget => ({ kind: 'row', nodeId, position });

/** Resolves the drop and applies it, returning the children of every folder. */
function dropAndMove(tree: Tree, draggedId: NodeId, target: DropTarget) {
  const result = resolveDrop(tree, draggedId, target);
  if (!result.ok) throw new Error(`drop rejected: ${result.reason}`);
  const moved = moveNode(tree, draggedId, result.parentId, result.index);
  expect(parseTree(moved).ok).toBe(true);
  const ids = (folderId: NodeId) => getChildren(moved, folderId).map((node) => node.id);
  return { root: ids(ROOT_ID), a: ids('a'), b: ids('b'), e: ids('e') };
}

describe('positionInRow', () => {
  it('splits page rows in half', () => {
    expect(positionInRow(5, 28, false)).toBe('before');
    expect(positionInRow(13.9, 28, false)).toBe('before');
    expect(positionInRow(14, 28, false)).toBe('after');
    expect(positionInRow(27, 28, false)).toBe('after');
  });

  it('gives folder rows a middle zone for dropping inside', () => {
    expect(positionInRow(6, 28, true)).toBe('before');
    expect(positionInRow(7, 28, true)).toBe('inside');
    expect(positionInRow(20, 28, true)).toBe('inside');
    expect(positionInRow(21, 28, true)).toBe('after');
  });

  it('treats a zero-height row as the middle', () => {
    expect(positionInRow(0, 0, true)).toBe('inside');
  });
});

describe('resolveDrop: reordering (FR-40)', () => {
  it('moves a row before or after a sibling', () => {
    expect(dropAndMove(sample(), 'r2', row('a', 'before')).root).toEqual(['r2', 'a', 'b', 'e', 'r1']);
    expect(dropAndMove(sample(), 'r1', row('r2', 'after')).root).toEqual(['a', 'b', 'e', 'r2', 'r1']);
    expect(dropAndMove(sample(), 'a', row('r1', 'after')).root).toEqual(['b', 'e', 'r1', 'a', 'r2']);
  });

  it('moves a row down past several siblings', () => {
    expect(dropAndMove(sample(), 'a', row('r2', 'after')).root).toEqual(['b', 'e', 'r1', 'r2', 'a']);
  });

  it('moves a row between folders', () => {
    const result = dropAndMove(sample(), 'r1', row('a1', 'after'));
    expect(result.a).toEqual(['a1', 'r1', 'a2']);
    expect(result.root).toEqual(['a', 'b', 'e', 'r2']);
  });

  it('moves a row out of a folder to the top level', () => {
    const result = dropAndMove(sample(), 'a2', row('r1', 'before'));
    expect(result.a).toEqual(['a1']);
    expect(result.root).toEqual(['a', 'b', 'e', 'a2', 'r1', 'r2']);
  });

  it('reports no change for a drop where the row already is', () => {
    const tree = sample();
    expect(resolveDrop(tree, 'r1', row('r1', 'before'))).toEqual({ ok: false, reason: 'no-change' });
    expect(resolveDrop(tree, 'r1', row('r1', 'after'))).toEqual({ ok: false, reason: 'no-change' });
    expect(resolveDrop(tree, 'r1', row('e', 'after'))).toEqual({ ok: false, reason: 'no-change' });
    expect(resolveDrop(tree, 'r1', row('r2', 'before'))).toEqual({ ok: false, reason: 'no-change' });
    expect(resolveDrop(tree, 'r2', { kind: 'end' })).toEqual({ ok: false, reason: 'no-change' });
  });
});

describe('resolveDrop: into folders (FR-41)', () => {
  it('appends to the end of a folder when dropped in its middle', () => {
    expect(dropAndMove(sample(), 'r1', row('a', 'inside')).a).toEqual(['a1', 'a2', 'r1']);
  });

  it('appends to a collapsed folder', () => {
    expect(dropAndMove(sample(), 'r1', row('b', 'inside')).b).toEqual(['b1', 'r1']);
  });

  it('drops into an empty folder', () => {
    expect(dropAndMove(sample(), 'r1', row('e', 'inside')).e).toEqual(['r1']);
  });

  it('puts the row first inside an expanded folder when dropped just below it', () => {
    expect(dropAndMove(sample(), 'r1', row('a', 'after')).a).toEqual(['r1', 'a1', 'a2']);
  });

  it('drops after a collapsed or empty folder as its sibling', () => {
    expect(dropAndMove(sample(), 'r2', row('b', 'after')).root).toEqual(['a', 'b', 'r2', 'e', 'r1']);
    expect(dropAndMove(sample(), 'r2', row('e', 'after')).root).toEqual(['a', 'b', 'e', 'r2', 'r1']);
  });

  it('moves a whole folder into another one', () => {
    const result = dropAndMove(sample(), 'b', row('a', 'inside'));
    expect(result.a).toEqual(['a1', 'a2', 'b']);
    expect(result.b).toEqual(['b1']);
  });

  it('appends to the top level when dropped in the empty space below the tree', () => {
    expect(dropAndMove(sample(), 'a1', { kind: 'end' }).root).toEqual(['a', 'b', 'e', 'r1', 'r2', 'a1']);
  });

  it('reports no change for dropping a folder\'s last row into that folder', () => {
    expect(resolveDrop(sample(), 'a2', row('a', 'inside'))).toEqual({ ok: false, reason: 'no-change' });
  });

  it('reports no change for dropping the only child just below its expanded folder', () => {
    let tree = sample();
    tree = moveNode(tree, 'a2', ROOT_ID);
    expect(resolveDrop(tree, 'a1', row('a', 'after'))).toEqual({ ok: false, reason: 'no-change' });
  });
});

describe('resolveDrop: rejected drops (FR-15, FR-42)', () => {
  it('treats any drop on the dragged row itself as no change, not as blocked', () => {
    for (const position of ['before', 'after', 'inside'] as const) {
      expect(resolveDrop(sample(), 'a', row('a', position))).toEqual({ ok: false, reason: 'no-change' });
    }
  });

  it('refuses a folder into one of its own rows or subfolders', () => {
    let tree = sample();
    tree = addFolder(tree, 'a', { id: 'deep', name: 'deep', createdAt: T0 });
    expect(resolveDrop(tree, 'a', row('a1', 'after'))).toEqual({ ok: false, reason: 'cycle' });
    expect(resolveDrop(tree, 'a', row('a1', 'before'))).toEqual({ ok: false, reason: 'cycle' });
    expect(resolveDrop(tree, 'a', row('deep', 'inside'))).toEqual({ ok: false, reason: 'cycle' });
  });

  it('refuses unknown rows and the root', () => {
    expect(resolveDrop(sample(), 'ghost', row('a', 'inside'))).toEqual({ ok: false, reason: 'missing' });
    expect(resolveDrop(sample(), 'r1', row('ghost', 'inside'))).toEqual({ ok: false, reason: 'missing' });
    expect(resolveDrop(sample(), ROOT_ID, row('a', 'inside'))).toEqual({ ok: false, reason: 'missing' });
  });
});
