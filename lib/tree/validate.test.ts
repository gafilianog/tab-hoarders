import { describe, expect, it } from 'vitest';
import { addFolder, addItem, createEmptyTree } from './tree';
import { ROOT_ID, type Tree } from './types';
import { parseTree } from './validate';

const T0 = 1_700_000_000_000;

/** root > a/ > i1 */
function sample(): Tree {
  let tree = createEmptyTree(T0);
  tree = addFolder(tree, ROOT_ID, { id: 'a', name: 'A', createdAt: T0 });
  tree = addItem(tree, 'a', { id: 'i1', url: 'https://example.com/', title: 'Example', createdAt: T0 });
  return tree;
}

/** A copy of the sample, damaged the way bad stored data might be. */
function damaged(edit: (raw: any) => void): unknown {
  const raw = structuredClone(sample());
  edit(raw);
  return raw;
}

function expectRejected(raw: unknown, reasonPart: string): void {
  const result = parseTree(raw);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toContain(reasonPart);
}

describe('parseTree', () => {
  it('accepts valid trees', () => {
    expect(parseTree(sample()).ok).toBe(true);
    expect(parseTree(createEmptyTree(T0)).ok).toBe(true);
  });

  it.each([null, undefined, [], 'tree', 42])('rejects a non-object: %j', (raw) => {
    expectRejected(raw, 'not an object');
  });

  it('rejects an unknown schema version', () => {
    expectRejected(damaged((raw) => (raw.schemaVersion = 2)), 'unsupported schemaVersion 2');
  });

  it('rejects missing nodes', () => {
    expectRejected(damaged((raw) => delete raw.nodes), 'nodes is missing');
  });

  it('rejects a missing root, or a root that is not a folder', () => {
    expectRejected(damaged((raw) => delete raw.nodes[ROOT_ID]), 'root folder is missing');
    expectRejected(
      damaged((raw) => {
        raw.nodes[ROOT_ID] = { type: 'item', id: ROOT_ID, parentId: 'a', url: 'https://x/', title: 'x', createdAt: T0 };
      }),
      'root folder is missing',
    );
  });

  it('rejects a root with a parent', () => {
    expectRejected(damaged((raw) => (raw.nodes[ROOT_ID].parentId = 'a')), 'invalid parentId');
  });

  it('rejects malformed nodes', () => {
    expectRejected(damaged((raw) => (raw.nodes.a.id = 'b')), 'mismatched id');
    expectRejected(damaged((raw) => (raw.nodes.i1.type = 'tab')), 'unknown type');
    expectRejected(damaged((raw) => (raw.nodes.i1.url = 5)), 'invalid url');
    expectRejected(damaged((raw) => (raw.nodes.a.childIds = 'i1')), 'invalid childIds');
    expectRejected(damaged((raw) => (raw.nodes.a.createdAt = 'yesterday')), 'invalid createdAt');
  });

  it('rejects a folder listing a child that does not exist', () => {
    expectRejected(damaged((raw) => raw.nodes.a.childIds.push('ghost')), 'lists missing child "ghost"');
  });

  it('rejects a node listed twice', () => {
    expectRejected(damaged((raw) => raw.nodes.a.childIds.push('i1')), 'listed more than once');
  });

  it('rejects a node whose parentId does not match the folder listing it', () => {
    expectRejected(damaged((raw) => (raw.nodes.i1.parentId = ROOT_ID)), 'but its parentId is');
  });

  it('rejects a node no folder lists', () => {
    expectRejected(
      damaged((raw) => {
        raw.nodes.orphan = { type: 'item', id: 'orphan', parentId: 'a', url: 'https://x/', title: 'x', createdAt: T0 };
      }),
      'not listed by any folder',
    );
  });

  it('rejects a cycle detached from the root', () => {
    expectRejected(
      damaged((raw) => {
        raw.nodes.x = { type: 'folder', id: 'x', parentId: 'y', name: 'x', childIds: ['y'], expanded: true, createdAt: T0 };
        raw.nodes.y = { type: 'folder', id: 'y', parentId: 'x', name: 'y', childIds: ['x'], expanded: true, createdAt: T0 };
      }),
      'cycle',
    );
  });
});
