import { describe, expect, it } from 'vitest';
import {
  TreeError,
  addFolder,
  addItem,
  collectItems,
  countDescendants,
  createEmptyTree,
  getChildren,
  getNode,
  isAncestor,
  isSaveableUrl,
  moveNode,
  removeNode,
  renameNode,
  setExpanded,
  type TreeErrorCode,
} from './tree';
import { ROOT_ID, type Tree } from './types';
import { parseTree } from './validate';

const T0 = 1_700_000_000_000;

function folder(tree: Tree, parentId: string, id: string, index?: number): Tree {
  return addFolder(tree, parentId, { id, name: id, createdAt: T0 }, index);
}

function item(tree: Tree, parentId: string, id: string, url = `https://example.com/${id}`): Tree {
  return addItem(tree, parentId, { id, url, title: id, createdAt: T0 });
}

function childIds(tree: Tree, folderId: string): string[] {
  return getChildren(tree, folderId).map((node) => node.id);
}

/** Every operation must leave a tree that the storage validator accepts. */
function expectValid(tree: Tree): void {
  expect(parseTree(tree)).toEqual({ ok: true, tree });
}

function expectTreeError(fn: () => unknown, code: TreeErrorCode): void {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(TreeError);
  expect((thrown as TreeError).code).toBe(code);
}

/**
 * root
 * ├─ work/
 * │  ├─ docs/
 * │  │  └─ d1
 * │  └─ w1
 * └─ r1
 */
function sample(): Tree {
  let tree = createEmptyTree(T0);
  tree = folder(tree, ROOT_ID, 'work');
  tree = folder(tree, 'work', 'docs');
  tree = item(tree, 'docs', 'd1');
  tree = item(tree, 'work', 'w1');
  tree = item(tree, ROOT_ID, 'r1');
  return tree;
}

describe('createEmptyTree', () => {
  it('has only an empty root folder', () => {
    const tree = createEmptyTree(T0);
    expect(Object.keys(tree.nodes)).toEqual([ROOT_ID]);
    expect(childIds(tree, ROOT_ID)).toEqual([]);
    expectValid(tree);
  });
});

describe('addFolder', () => {
  it('appends to the parent by default and supports nesting', () => {
    const tree = sample();
    expect(childIds(tree, ROOT_ID)).toEqual(['work', 'r1']);
    expect(childIds(tree, 'work')).toEqual(['docs', 'w1']);
    expectValid(tree);
  });

  it('inserts at a given index', () => {
    const tree = folder(sample(), ROOT_ID, 'first', 0);
    expect(childIds(tree, ROOT_ID)).toEqual(['first', 'work', 'r1']);
    expectValid(tree);
  });

  it('trims the name and rejects an empty one', () => {
    const tree = addFolder(createEmptyTree(T0), ROOT_ID, { id: 'f', name: '  Reading  ', createdAt: T0 });
    expect(getNode(tree, 'f')).toMatchObject({ name: 'Reading' });
    expectTreeError(
      () => addFolder(tree, ROOT_ID, { id: 'g', name: '   ', createdAt: T0 }),
      'INVALID_NAME',
    );
  });

  it('allows sibling folders with the same name (D6)', () => {
    let tree = createEmptyTree(T0);
    tree = addFolder(tree, ROOT_ID, { id: 'a', name: 'Same', createdAt: T0 });
    tree = addFolder(tree, ROOT_ID, { id: 'b', name: 'Same', createdAt: T0 });
    expect(childIds(tree, ROOT_ID)).toEqual(['a', 'b']);
  });

  it('rejects a missing parent, an item as parent, and a duplicate id', () => {
    const tree = sample();
    expectTreeError(() => folder(tree, 'nope', 'x'), 'NOT_FOUND');
    expectTreeError(() => folder(tree, 'r1', 'x'), 'NOT_A_FOLDER');
    expectTreeError(() => folder(tree, ROOT_ID, 'work'), 'DUPLICATE_ID');
  });

  it('does not change the input tree', () => {
    const before = sample();
    const snapshot = structuredClone(before);
    folder(before, ROOT_ID, 'x');
    expect(before).toEqual(snapshot);
  });
});

describe('addItem', () => {
  it('stores the URL and title', () => {
    const tree = addItem(createEmptyTree(T0), ROOT_ID, {
      id: 'i',
      url: 'https://example.com/a',
      title: ' Example ',
      createdAt: T0,
    });
    expect(getNode(tree, 'i')).toMatchObject({ url: 'https://example.com/a', title: 'Example', parentId: ROOT_ID });
    expectValid(tree);
  });

  it('falls back to the URL when the title is empty', () => {
    const tree = addItem(createEmptyTree(T0), ROOT_ID, {
      id: 'i',
      url: 'https://example.com/a',
      title: '  ',
      createdAt: T0,
    });
    expect(getNode(tree, 'i')).toMatchObject({ title: 'https://example.com/a' });
  });

  it.each([
    'chrome://extensions',
    'file:///Users/someone/notes.txt',
    'about:blank',
    'chrome-extension://abcdefgh/page.html',
    'javascript:alert(1)',
    'not a url',
    '',
  ])('rejects a non-http(s) URL: %j (FR-22)', (url) => {
    expect(isSaveableUrl(url)).toBe(false);
    expectTreeError(() => item(createEmptyTree(T0), ROOT_ID, 'i', url), 'INVALID_URL');
  });

  it('accepts http and https URLs', () => {
    expect(isSaveableUrl('http://localhost:3000/')).toBe(true);
    expect(isSaveableUrl('https://example.com/path?q=1#x')).toBe(true);
  });

  it('allows the same URL more than once (D5)', () => {
    let tree = createEmptyTree(T0);
    tree = item(tree, ROOT_ID, 'a', 'https://example.com/');
    tree = item(tree, ROOT_ID, 'b', 'https://example.com/');
    expect(childIds(tree, ROOT_ID)).toEqual(['a', 'b']);
  });
});

describe('renameNode', () => {
  it('renames folders and items', () => {
    let tree = renameNode(sample(), 'work', 'Work stuff');
    tree = renameNode(tree, 'r1', 'Read later');
    expect(getNode(tree, 'work')).toMatchObject({ name: 'Work stuff' });
    expect(getNode(tree, 'r1')).toMatchObject({ title: 'Read later' });
    expectValid(tree);
  });

  it('rejects an empty name and the root', () => {
    expectTreeError(() => renameNode(sample(), 'work', ''), 'INVALID_NAME');
    expectTreeError(() => renameNode(sample(), ROOT_ID, 'x'), 'ROOT_IMMUTABLE');
  });
});

describe('setExpanded', () => {
  it('collapses and expands a folder', () => {
    const collapsed = setExpanded(sample(), 'work', false);
    expect(getNode(collapsed, 'work')).toMatchObject({ expanded: false });
    expect(getNode(setExpanded(collapsed, 'work', true), 'work')).toMatchObject({ expanded: true });
  });

  it('returns the same tree when nothing changes', () => {
    const tree = sample();
    expect(setExpanded(tree, 'work', true)).toBe(tree);
  });
});

describe('removeNode', () => {
  it('removes a folder with everything inside it', () => {
    const tree = removeNode(sample(), 'work');
    expect(Object.keys(tree.nodes).sort()).toEqual(['r1', ROOT_ID].sort());
    expect(childIds(tree, ROOT_ID)).toEqual(['r1']);
    expectValid(tree);
  });

  it('removes a single item', () => {
    const tree = removeNode(sample(), 'w1');
    expect(childIds(tree, 'work')).toEqual(['docs']);
    expectValid(tree);
  });

  it('rejects the root and unknown ids', () => {
    expectTreeError(() => removeNode(sample(), ROOT_ID), 'ROOT_IMMUTABLE');
    expectTreeError(() => removeNode(sample(), 'nope'), 'NOT_FOUND');
  });
});

describe('moveNode', () => {
  it('moves a node into another folder', () => {
    const tree = moveNode(sample(), 'r1', 'docs');
    expect(childIds(tree, 'docs')).toEqual(['d1', 'r1']);
    expect(childIds(tree, ROOT_ID)).toEqual(['work']);
    expect(getNode(tree, 'r1').parentId).toBe('docs');
    expectValid(tree);
  });

  it('moves a folder together with its contents', () => {
    const tree = moveNode(sample(), 'docs', ROOT_ID, 0);
    expect(childIds(tree, ROOT_ID)).toEqual(['docs', 'work', 'r1']);
    expect(childIds(tree, 'docs')).toEqual(['d1']);
    expectValid(tree);
  });

  it('reorders within a folder, treating index as the final position', () => {
    let tree = createEmptyTree(T0);
    tree = item(tree, ROOT_ID, 'a');
    tree = item(tree, ROOT_ID, 'b');
    tree = item(tree, ROOT_ID, 'c');

    tree = moveNode(tree, 'a', ROOT_ID, 2);
    expect(childIds(tree, ROOT_ID)).toEqual(['b', 'c', 'a']);
    tree = moveNode(tree, 'a', ROOT_ID, 0);
    expect(childIds(tree, ROOT_ID)).toEqual(['a', 'b', 'c']);
    expectValid(tree);
  });

  it('clamps an out-of-range index', () => {
    let tree = createEmptyTree(T0);
    tree = item(tree, ROOT_ID, 'a');
    tree = item(tree, ROOT_ID, 'b');
    expect(childIds(moveNode(tree, 'a', ROOT_ID, 99), ROOT_ID)).toEqual(['b', 'a']);
    expect(childIds(moveNode(tree, 'b', ROOT_ID, -5), ROOT_ID)).toEqual(['b', 'a']);
  });

  it('refuses to move a folder into itself or its subfolders (FR-15)', () => {
    expectTreeError(() => moveNode(sample(), 'work', 'work'), 'CYCLE');
    expectTreeError(() => moveNode(sample(), 'work', 'docs'), 'CYCLE');
  });

  it('refuses an item as the target, and moving the root', () => {
    expectTreeError(() => moveNode(sample(), 'w1', 'r1'), 'NOT_A_FOLDER');
    expectTreeError(() => moveNode(sample(), ROOT_ID, 'work'), 'ROOT_IMMUTABLE');
  });
});

describe('countDescendants', () => {
  it('counts folders and items at every depth (FR-12)', () => {
    expect(countDescendants(sample(), 'work')).toEqual({ folders: 1, items: 2 });
    expect(countDescendants(sample(), ROOT_ID)).toEqual({ folders: 2, items: 3 });
    expect(countDescendants(sample(), 'docs')).toEqual({ folders: 0, items: 1 });
  });
});

describe('collectItems', () => {
  it('returns items through all subfolders, top to bottom (FR-30)', () => {
    expect(collectItems(sample(), ROOT_ID).map((node) => node.id)).toEqual(['d1', 'w1', 'r1']);
    expect(collectItems(sample(), 'work').map((node) => node.id)).toEqual(['d1', 'w1']);
  });

  it('rejects an item id', () => {
    expectTreeError(() => collectItems(sample(), 'r1'), 'NOT_A_FOLDER');
  });
});

describe('deep nesting (FR-14)', () => {
  it('works 20 folders deep', () => {
    let tree = createEmptyTree(T0);
    let parentId = ROOT_ID;
    for (let depth = 1; depth <= 20; depth += 1) {
      tree = folder(tree, parentId, `f${depth}`);
      parentId = `f${depth}`;
    }
    tree = item(tree, 'f20', 'leaf');

    expectValid(tree);
    expect(isAncestor(tree, 'f1', 'leaf')).toBe(true);
    expect(countDescendants(tree, 'f1')).toEqual({ folders: 19, items: 1 });
    expect(collectItems(tree, ROOT_ID).map((node) => node.id)).toEqual(['leaf']);
    expectTreeError(() => moveNode(tree, 'f1', 'f20'), 'CYCLE');
  });
});
