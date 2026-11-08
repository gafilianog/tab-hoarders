import { describe, expect, it } from 'vitest';
import { SAVE_TARGET_KEY, loadSaveTarget, storeSaveTarget } from './settings';
import type { KeyValueArea } from './tree-repository';

function memoryArea(initial: Record<string, unknown> = {}): KeyValueArea {
  const data: Record<string, unknown> = { ...initial };
  return {
    async get(key) {
      return key in data ? { [key]: data[key] } : {};
    },
    async set(items) {
      Object.assign(data, items);
    },
  };
}

describe('save target setting', () => {
  it('is null until something is stored', async () => {
    expect(await loadSaveTarget(memoryArea())).toBeNull();
  });

  it('stores and reads back a folder id', async () => {
    const area = memoryArea();
    await storeSaveTarget(area, 'folder-1');
    expect(await loadSaveTarget(area)).toBe('folder-1');
  });

  it('ignores a stored value that is not a string', async () => {
    expect(await loadSaveTarget(memoryArea({ [SAVE_TARGET_KEY]: 42 }))).toBeNull();
  });
});
