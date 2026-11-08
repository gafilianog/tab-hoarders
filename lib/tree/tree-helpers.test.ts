import { describe, expect, it } from 'vitest';
import {
  addFolder,
  addItem,
  createEmptyTree,
  existingFolderOrRoot,
  expandPath,
  getChildren,
  getNode,
  hasNode,
  listFolders,
  reinsertItem,
  removeNode,
  setExpanded,
} from './tree';
import { ROOT_ID, type ItemNode, type Tree } from './types';
import { parseTree } from './validate';

const T0 = 1_700_000_000_000;

/**
 * root
 * ├─ a/
 * │  ├─ b/
 * │  │  └─ c/
 * │  └─ i1
 * └─ d/
 */
function sample(): Tree {
  let tree = createEmptyTree(T0);
  for (const [parentId, id] of [
    [ROOT_ID, 'a'],
    ['a', 'b'],
    ['b', 'c'],
    [ROOT_ID, 'd'],
  ] as const) {
    tree = addFolder(tree, parentId, { id, name: id.toUpperCase(), createdAt: T0 });
  }
  return addItem(tree, 'a', { id: 'i1', url: 'https://example.com/', title: 'Example', createdAt: T0 });
}

const ids = (tree: Tree, folderId: string) => getChildren(tree, folderId).map((node) => node.id);

describe('hasNode and existingFolderOrRoot', () => {
  it('finds folders and falls back to the root otherwise', () => {
    const tree = sample();
    expect(hasNode(tree, 'b')).toBe(true);
    expect(hasNode(tree, 'nope')).toBe(false);
    expect(existingFolderOrRoot(tree, 'b')).toBe('b');
    expect(existingFolderOrRoot(tree, 'nope')).toBe(ROOT_ID);
    expect(existingFolderOrRoot(tree, 'i1')).toBe(ROOT_ID);
  });
});

describe('expandPath', () => {
  it('expands a folder and all folders above it', () => {
    let tree = sample();
    for (const id of ['a', 'b', 'c']) tree = setExpanded(tree, id, false);

    tree = expandPath(tree, 'c');

    for (const id of ['a', 'b', 'c']) expect(getNode(tree, id)).toMatchObject({ expanded: true });
    expect(parseTree(tree).ok).toBe(true);
  });

  it('leaves unrelated folders alone', () => {
    const tree = expandPath(setExpanded(sample(), 'd', false), 'c');
    expect(getNode(tree, 'd')).toMatchObject({ expanded: false });
  });

  it('accepts the root', () => {
    const tree = sample();
    expect(expandPath(tree, ROOT_ID)).toBe(tree);
  });
});

describe('listFolders', () => {
  it('lists every folder in display order with its depth', () => {
    const tree = setExpanded(sample(), 'a', false);
    expect(listFolders(tree).map(({ folder, depth }) => [folder.id, depth])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['d', 0],
    ]);
  });

  it('is empty for an empty tree', () => {
    expect(listFolders(createEmptyTree(T0))).toEqual([]);
  });
});

describe('reinsertItem', () => {
  function deleteI1(tree: Tree): { tree: Tree; item: ItemNode; index: number } {
    const item = getNode(tree, 'i1') as ItemNode;
    const index = ids(tree, 'a').indexOf('i1');
    return { tree: removeNode(tree, 'i1'), item, index };
  }

  it('puts an item back where it was', () => {
    const { tree, item, index } = deleteI1(sample());
    const restored = reinsertItem(tree, item, index);
    expect(ids(restored, 'a')).toEqual(['b', 'i1']);
    expect(getNode(restored, 'i1')).toEqual(item);
    expect(parseTree(restored).ok).toBe(true);
  });

  it('falls back to the end of the top level if the folder is gone', () => {
    const { tree, item, index } = deleteI1(sample());
    const restored = reinsertItem(removeNode(tree, 'a'), item, index);
    expect(ids(restored, ROOT_ID)).toEqual(['d', 'i1']);
    expect(getNode(restored, 'i1').parentId).toBe(ROOT_ID);
    expect(parseTree(restored).ok).toBe(true);
  });
});
