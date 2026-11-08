import { createEmptyTree } from '../tree/tree';
import type { Tree } from '../tree/types';
import { parseTree } from '../tree/validate';

/** The whole tree is stored under one key, so each write replaces it in one step. */
export const TREE_STORAGE_KEY = 'tabHoarders.tree';

/** Name of the lock that every panel takes before changing the tree. */
export const TREE_LOCK_NAME = 'tabHoarders.tree';

/**
 * The slice of chrome.storage.local the repository needs. Tests pass an
 * in-memory fake instead.
 */
export interface KeyValueArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/**
 * Runs `task` while holding a lock shared by every place that writes the
 * tree. In the browser this is the Web Locks API (see
 * browser-tree-repository.ts). Tests pass a fake.
 */
export type WriteLock = <T>(task: () => Promise<T>) => Promise<T>;

/** No cross-page lock: writes are only ordered within one repository. */
export const noLock: WriteLock = (task) => task();

export type LoadResult =
  | { status: 'ok'; tree: Tree }
  | { status: 'corrupt'; reason: string; raw: unknown };

/**
 * Turns a stored value into a tree. Nothing stored (undefined) means a new,
 * empty tree. Used for loading and for change events from other windows.
 */
export function interpretStoredTree(raw: unknown, now: number): LoadResult {
  if (raw === undefined) return { status: 'ok', tree: createEmptyTree(now) };
  const parsed = parseTree(raw);
  return parsed.ok ? { status: 'ok', tree: parsed.tree } : { status: 'corrupt', reason: parsed.reason, raw };
}

/** Thrown by update() when the stored tree fails validation. Nothing is written. */
export class CorruptTreeError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Stored tree is unreadable: ${reason}`);
    this.name = 'CorruptTreeError';
    this.reason = reason;
  }
}

export interface TreeRepositoryOptions {
  now?: () => number;
  lock?: WriteLock;
}

/**
 * The only code that reads or writes the tree in storage.
 *
 * Each update re-reads the stored tree, applies its change and writes the
 * result, all while holding the shared lock. So two panels (for example in
 * two windows) can never both read the same old tree and overwrite each
 * other's change (PRD NFR-2). Within one repository, updates also run in the
 * order they were made.
 */
export class TreeRepository {
  private readonly area: KeyValueArea;
  private readonly now: () => number;
  private readonly lock: WriteLock;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(area: KeyValueArea, options: TreeRepositoryOptions = {}) {
    this.area = area;
    this.now = options.now ?? Date.now;
    this.lock = options.lock ?? noLock;
  }

  /**
   * Reads the tree. With nothing stored yet it returns a new empty tree
   * without writing it; the first update() saves it.
   */
  async load(): Promise<LoadResult> {
    const stored = await this.area.get(TREE_STORAGE_KEY);
    return interpretStoredTree(stored[TREE_STORAGE_KEY], this.now());
  }

  /**
   * Applies `mutate` to the latest stored tree and saves the result.
   * If `mutate` throws, or the stored tree is corrupt, nothing is written and
   * the promise rejects. If `mutate` returns the tree unchanged, nothing is
   * written either.
   */
  update(mutate: (tree: Tree) => Tree): Promise<Tree> {
    const run = () =>
      this.lock(async (): Promise<Tree> => {
        const loaded = await this.load();
        if (loaded.status === 'corrupt') throw new CorruptTreeError(loaded.reason);
        const next = mutate(loaded.tree);
        if (next !== loaded.tree) await this.area.set({ [TREE_STORAGE_KEY]: next });
        return next;
      });
    const result = this.queue.then(run, run);
    // Keep the queue going even if this update fails.
    this.queue = result.catch(() => undefined);
    return result;
  }
}
