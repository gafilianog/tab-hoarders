import { describe, expect, it } from 'vitest';
import { CorruptTreeError, TREE_STORAGE_KEY, TreeRepository, type KeyValueArea } from '../storage/tree-repository';
import { addFolder, getChildren, getNode } from '../tree/tree';
import { ROOT_ID } from '../tree/types';
import { pageFromMenuClick, savePageToTopLevel } from './save-page';

const T0 = 1_700_000_000_000;

/** In-memory stand-in for chrome.storage.local that counts writes. */
function memoryArea(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(structuredClone(initial)));
  const area = {
    writes: 0,
    async get(key: string): Promise<Record<string, unknown>> {
      return data.has(key) ? { [key]: structuredClone(data.get(key)) } : {};
    },
    async set(items: Record<string, unknown>): Promise<void> {
      area.writes += 1;
      for (const [key, value] of Object.entries(items)) data.set(key, structuredClone(value));
    },
  };
  return area satisfies KeyValueArea;
}

describe('pageFromMenuClick', () => {
  it('uses the clicked page and the tab title', () => {
    expect(
      pageFromMenuClick({ pageUrl: 'https://example.com/a' }, { url: 'https://example.com/a', title: 'A' }),
    ).toEqual({ url: 'https://example.com/a', title: 'A' });
  });

  it('leaves the title empty when the tab shows a different page', () => {
    expect(
      pageFromMenuClick({ pageUrl: 'https://example.com/a' }, { url: 'https://example.com/b', title: 'B' }),
    ).toEqual({ url: 'https://example.com/a', title: '' });
  });

  it('falls back to the tab URL when the click has no page URL', () => {
    expect(pageFromMenuClick({}, { url: 'https://example.com/a', title: 'A' })).toEqual({
      url: 'https://example.com/a',
      title: 'A',
    });
  });

  it.each([
    [{ pageUrl: 'chrome://settings/' }, undefined],
    [{ pageUrl: 'file:///Users/someone/notes.txt' }, undefined],
    [{}, undefined],
    [{}, { title: 'No URL' }],
  ])('returns null for a page that cannot be saved: %j', (info, tab) => {
    expect(pageFromMenuClick(info, tab)).toBeNull();
  });
});

describe('savePageToTopLevel (FR-27)', () => {
  it('adds the page at the end of the top level, never inside a folder', async () => {
    const repository = new TreeRepository(memoryArea(), { now: () => T0 });
    await repository.update((tree) => addFolder(tree, ROOT_ID, { id: 'f', name: 'Folder', createdAt: T0 }));

    const tree = await savePageToTopLevel(
      repository,
      { url: 'https://example.com/a', title: 'A' },
      { id: 'new', createdAt: T0 },
    );

    expect(getChildren(tree, ROOT_ID).map((node) => node.id)).toEqual(['f', 'new']);
    expect(getChildren(tree, 'f')).toEqual([]);
    expect(getNode(tree, 'new')).toMatchObject({ parentId: ROOT_ID, url: 'https://example.com/a', title: 'A' });
  });

  it('uses the URL as the title when the title is empty', async () => {
    const repository = new TreeRepository(memoryArea(), { now: () => T0 });
    const tree = await savePageToTopLevel(repository, { url: 'https://example.com/a', title: '' }, { id: 'i', createdAt: T0 });
    expect(getNode(tree, 'i')).toMatchObject({ title: 'https://example.com/a' });
  });

  it('writes nothing when the stored tree is corrupt (FR-53)', async () => {
    const area = memoryArea({ [TREE_STORAGE_KEY]: { schemaVersion: 99 } });
    const repository = new TreeRepository(area, { now: () => T0 });

    await expect(
      savePageToTopLevel(repository, { url: 'https://example.com/a', title: 'A' }, { id: 'i', createdAt: T0 }),
    ).rejects.toBeInstanceOf(CorruptTreeError);
    expect(area.writes).toBe(0);
  });
});
