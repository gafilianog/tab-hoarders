import { browser } from 'wxt/browser';
import {
  TREE_LOCK_NAME,
  TREE_STORAGE_KEY,
  TreeRepository,
  interpretStoredTree,
  type LoadResult,
  type WriteLock,
} from './tree-repository';

/**
 * Web Locks are shared by every page of this extension (same origin), so a
 * side panel in one window waits while a panel in another window is
 * changing the tree.
 *
 * request() resolves with whatever the task's promise resolves to, but the
 * DOM typings declare Promise<Promise<T>>, hence the cast.
 */
const webLock: WriteLock = <T>(task: () => Promise<T>) =>
  navigator.locks.request(TREE_LOCK_NAME, task) as unknown as Promise<T>;

/** The repository backed by the extension's local storage (PRD D2). */
export function createBrowserTreeRepository(): TreeRepository {
  return new TreeRepository(browser.storage.local, { lock: webLock });
}

/**
 * Calls `listener` whenever the stored tree changes, including changes made
 * in other windows (PRD FR-5). Returns a function that stops listening.
 */
export function watchStoredTree(listener: (result: LoadResult) => void): () => void {
  const onChanged = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName !== 'local' || !(TREE_STORAGE_KEY in changes)) return;
    listener(interpretStoredTree(changes[TREE_STORAGE_KEY]?.newValue, Date.now()));
  };
  browser.storage.onChanged.addListener(onChanged);
  return () => browser.storage.onChanged.removeListener(onChanged);
}
