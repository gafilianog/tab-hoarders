import { describe, expect, it } from 'vitest';
import { TreeError, addFolder, getChildren } from '../tree/tree';
import { ROOT_ID, type Tree } from '../tree/types';
import {
  CorruptTreeError,
  TREE_STORAGE_KEY,
  TreeRepository,
  interpretStoredTree,
  type WriteLock,
} from './tree-repository';

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
    const repository = new TreeRepository(area, { now: () => T0 });

    const loaded = await repository.load();

    expect(loaded.status).toBe('ok');
    expect(await rootChildIds(repository)).toEqual([]);
    expect(area.writes).toBe(0);
  });

  it('saves updates and reads them back', async () => {
    const area = createMemoryArea();
    const repository = new TreeRepository(area, { now: () => T0 });

    await repository.update(addRootFolder('a'));

    expect(area.writes).toBe(1);
    expect(await rootChildIds(new TreeRepository(area))).toEqual(['a']);
  });

  it('keeps both of two updates started at the same time', async () => {
    const repository = new TreeRepository(createMemoryArea(), { now: () => T0 });

    await Promise.all([repository.update(addRootFolder('a')), repository.update(addRootFolder('b'))]);

    expect(await rootChildIds(repository)).toEqual(['a', 'b']);
  });

  it('re-reads storage before each update, keeping changes written elsewhere', async () => {
    const area = createMemoryArea();
    const panelA = new TreeRepository(area, { now: () => T0 });
    const panelB = new TreeRepository(area, { now: () => T0 });

    await panelA.load();
    await panelB.update(addRootFolder('fromB'));
    await panelA.update(addRootFolder('fromA'));

    expect(await rootChildIds(panelA)).toEqual(['fromB', 'fromA']);
  });

  it('writes nothing when the change fails, and keeps working afterwards', async () => {
    const area = createMemoryArea();
    const repository = new TreeRepository(area, { now: () => T0 });
    await repository.update(addRootFolder('a'));

    await expect(repository.update(addRootFolder('a'))).rejects.toBeInstanceOf(TreeError);
    expect(area.writes).toBe(1);

    await repository.update(addRootFolder('b'));
    expect(await rootChildIds(repository)).toEqual(['a', 'b']);
  });

  it('does not write when the change leaves the tree as it was', async () => {
    const area = createMemoryArea();
    const repository = new TreeRepository(area, { now: () => T0 });
    await repository.update(addRootFolder('a'));

    await repository.update((tree) => tree);

    expect(area.writes).toBe(1);
  });

  it('reports corrupt data and never overwrites it (FR-53)', async () => {
    const raw = { schemaVersion: 99, nodes: {} };
    const area = createMemoryArea({ [TREE_STORAGE_KEY]: raw });
    const repository = new TreeRepository(area, { now: () => T0 });

    const loaded = await repository.load();
    expect(loaded).toEqual({ status: 'corrupt', reason: 'unsupported schemaVersion 99', raw });

    await expect(repository.update(addRootFolder('a'))).rejects.toBeInstanceOf(CorruptTreeError);
    expect(area.writes).toBe(0);
    expect(area.data.get(TREE_STORAGE_KEY)).toEqual(raw);
  });
});

describe('TreeRepository across panels (NFR-2)', () => {
  /**
   * Storage whose reads take a few milliseconds, so two panels that start
   * writing at once both read before either writes, as can happen with real
   * IPC-backed storage.
   */
  function slowArea() {
    const area = createMemoryArea();
    const fastGet = area.get;
    area.get = async (key: string) => {
      // Take the snapshot when the read starts and deliver it later, so a
      // write that lands in between is not seen.
      const snapshot = await fastGet(key);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return snapshot;
    };
    return area;
  }

  /** A simple mutex: tasks run one at a time in the order they asked. */
  function createSharedLock(): WriteLock {
    let tail: Promise<unknown> = Promise.resolve();
    return (task) => {
      const result = tail.then(task, task);
      tail = result.catch(() => undefined);
      return result;
    };
  }

  it('loses a change when two panels write at once without a shared lock', async () => {
    const area = slowArea();
    const panelA = new TreeRepository(area, { now: () => T0 });
    const panelB = new TreeRepository(area, { now: () => T0 });

    await Promise.all([panelA.update(addRootFolder('fromA')), panelB.update(addRootFolder('fromB'))]);

    // Documents the hazard the lock exists for: one write replaced the other.
    expect((await rootChildIds(panelA)).length).toBe(1);
  });

  it('keeps both changes when the panels share a lock', async () => {
    const area = slowArea();
    const lock = createSharedLock();
    const panelA = new TreeRepository(area, { now: () => T0, lock });
    const panelB = new TreeRepository(area, { now: () => T0, lock });

    await Promise.all([panelA.update(addRootFolder('fromA')), panelB.update(addRootFolder('fromB'))]);

    expect(await rootChildIds(panelA)).toEqual(['fromA', 'fromB']);
  });

  it('releases the lock when a change fails', async () => {
    const lock = createSharedLock();
    const repository = new TreeRepository(createMemoryArea(), { now: () => T0, lock });
    await repository.update(addRootFolder('a'));

    await expect(repository.update(addRootFolder('a'))).rejects.toBeInstanceOf(TreeError);
    await repository.update(addRootFolder('b'));

    expect(await rootChildIds(repository)).toEqual(['a', 'b']);
  });
});

describe('interpretStoredTree', () => {
  it('treats nothing stored as an empty tree', () => {
    const result = interpretStoredTree(undefined, T0);
    expect(result.status).toBe('ok');
  });

  it('reports invalid data as corrupt and keeps the raw value', () => {
    expect(interpretStoredTree({ schemaVersion: 99 }, T0)).toEqual({
      status: 'corrupt',
      reason: 'unsupported schemaVersion 99',
      raw: { schemaVersion: 99 },
    });
  });
});
