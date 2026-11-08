import { describe, expect, it } from 'vitest';
import { TreeError, addFolder, getChildren } from '../tree/tree';
import { ROOT_ID, type Tree } from '../tree/types';
import { CorruptTreeError, TREE_STORAGE_KEY, TreeRepository } from './tree-repository';

const T0 = 1_700_000_000_000;

/**
 * In-memory stand-in for chrome.storage.local. Values are copied on the way
 * in and out, as real storage serializes them.
 */
function createMemoryArea(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(structuredClone(initial)));
  const area = {
    writes: 0,
    data,
    async get(key: string): Promise<Record<string, unknown>> {
      return data.has(key) ? { [key]: structuredClone(data.get(key)) } : {};
    },
    async set(items: Record<string, unknown>): Promise<void> {
      area.writes += 1;
      for (const [key, value] of Object.entries(items)) data.set(key, structuredClone(value));
    },
  };
  return area;
}

const addRootFolder = (id: string) => (tree: Tree) =>
  addFolder(tree, ROOT_ID, { id, name: id, createdAt: T0 });

async function rootChildIds(repository: TreeRepository): Promise<string[]> {
  const loaded = await repository.load();
  if (loaded.status !== 'ok') throw new Error(`unexpected ${loaded.status}`);
  return getChildren(loaded.tree, ROOT_ID).map((node) => node.id);
}

describe('TreeRepository', () => {
  it('returns an empty tree when nothing is stored, without writing', async () => {
    const area = createMemoryArea();
    const repository = new TreeRepository(area, () => T0);

    const loaded = await repository.load();

    expect(loaded.status).toBe('ok');
    expect(await rootChildIds(repository)).toEqual([]);
    expect(area.writes).toBe(0);
  });

  it('saves updates and reads them back', async () => {
    const area = createMemoryArea();
    const repository = new TreeRepository(area, () => T0);

    await repository.update(addRootFolder('a'));

    expect(area.writes).toBe(1);
    expect(await rootChildIds(new TreeRepository(area))).toEqual(['a']);
  });

  it('keeps both of two updates started at the same time', async () => {
    const repository = new TreeRepository(createMemoryArea(), () => T0);

    await Promise.all([repository.update(addRootFolder('a')), repository.update(addRootFolder('b'))]);

    expect(await rootChildIds(repository)).toEqual(['a', 'b']);
  });

  it('re-reads storage before each update, keeping changes written elsewhere', async () => {
    const area = createMemoryArea();
    const panelA = new TreeRepository(area, () => T0);
    const panelB = new TreeRepository(area, () => T0);

    await panelA.load();
    await panelB.update(addRootFolder('fromB'));
    await panelA.update(addRootFolder('fromA'));

    expect(await rootChildIds(panelA)).toEqual(['fromB', 'fromA']);
  });

  it('writes nothing when the change fails, and keeps working afterwards', async () => {
    const area = createMemoryArea();
    const repository = new TreeRepository(area, () => T0);
    await repository.update(addRootFolder('a'));

    await expect(repository.update(addRootFolder('a'))).rejects.toBeInstanceOf(TreeError);
    expect(area.writes).toBe(1);

    await repository.update(addRootFolder('b'));
    expect(await rootChildIds(repository)).toEqual(['a', 'b']);
  });

  it('reports corrupt data and never overwrites it (FR-53)', async () => {
    const raw = { schemaVersion: 99, nodes: {} };
    const area = createMemoryArea({ [TREE_STORAGE_KEY]: raw });
    const repository = new TreeRepository(area, () => T0);

    const loaded = await repository.load();
    expect(loaded).toEqual({ status: 'corrupt', reason: 'unsupported schemaVersion 99', raw });

    await expect(repository.update(addRootFolder('a'))).rejects.toBeInstanceOf(CorruptTreeError);
    expect(area.writes).toBe(0);
    expect(area.data.get(TREE_STORAGE_KEY)).toEqual(raw);
  });
});
