import { createEmptyTree } from '../tree/tree';
import type { Tree } from '../tree/types';
import { parseTree } from '../tree/validate';

/** The whole tree is stored under one key, so each write replaces it in one step. */
export const TREE_STORAGE_KEY = 'tabHoarders.tree';

/**
 * The slice of chrome.storage.local the repository needs. Tests pass an
 * in-memory fake instead.
 */
export interface KeyValueArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export type LoadResult =
  | { status: 'ok'; tree: Tree }
  | { status: 'corrupt'; reason: string; raw: unknown };

/** Thrown by update() when the stored tree fails validation. Nothing is written. */
export class CorruptTreeError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Stored tree is unreadable: ${reason}`);
    this.name = 'CorruptTreeError';
    this.reason = reason;
  }
}

/**
 * The only code that reads or writes the tree in storage.
 *
 * Writes from one repository instance run one at a time, and each one re-reads
 * the stored tree before applying its change, so a write never replaces newer
 * data with a stale in-memory copy.
 *
 * Known limit: two instances in different extension pages (for example side
 * panels in two windows) can still interleave a read and a write. Whether to
 * route all writes through the service worker is decided in M4 (PRD FR-5,
 * NFR-2).
 */
export class TreeRepository {
  private readonly area: KeyValueArea;
  private readonly now: () => number;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(area: KeyValueArea, now: () => number = Date.now) {
    this.area = area;
    this.now = now;
  }

  /**
   * Reads the tree. With nothing stored yet it returns a new empty tree
   * without writing it; the first update() saves it.
   */
  async load(): Promise<LoadResult> {
    const stored = await this.area.get(TREE_STORAGE_KEY);
    const raw = stored[TREE_STORAGE_KEY];
    if (raw === undefined) return { status: 'ok', tree: createEmptyTree(this.now()) };
    const parsed = parseTree(raw);
    return parsed.ok
      ? { status: 'ok', tree: parsed.tree }
      : { status: 'corrupt', reason: parsed.reason, raw };
  }

  /**
   * Applies `mutate` to the latest stored tree and saves the result.
   * If `mutate` throws, or the stored tree is corrupt, nothing is written and
   * the promise rejects.
   */
  update(mutate: (tree: Tree) => Tree): Promise<Tree> {
    const run = async (): Promise<Tree> => {
      const loaded = await this.load();
      if (loaded.status === 'corrupt') throw new CorruptTreeError(loaded.reason);
      const next = mutate(loaded.tree);
      await this.area.set({ [TREE_STORAGE_KEY]: next });
      return next;
    };
    const result = this.queue.then(run, run);
    // Keep the queue going even if this update fails.
    this.queue = result.catch(() => undefined);
    return result;
  }
}
