import { useCallback, useEffect, useState } from 'react';
import { createBrowserTreeRepository } from '@/lib/storage/browser-tree-repository';
import { CorruptTreeError } from '@/lib/storage/tree-repository';
import type { Tree } from '@/lib/tree/types';

// One repository per panel page, so all writes from this panel share its queue.
const repository = createBrowserTreeRepository();

export type TreeState =
  | { status: 'loading' }
  | { status: 'ready'; tree: Tree }
  | { status: 'corrupt'; reason: string }
  | { status: 'failed'; message: string };

export type UpdateTree = (mutate: (tree: Tree) => Tree) => Promise<boolean>;

/**
 * Loads the tree once when the panel opens, and applies changes through the
 * repository. The panel shows whatever the last successful write returned.
 */
export function useTree() {
  const [state, setState] = useState<TreeState>({ status: 'loading' });
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repository.load().then(
      (result) => {
        if (cancelled) return;
        setState(
          result.status === 'ok'
            ? { status: 'ready', tree: result.tree }
            : { status: 'corrupt', reason: result.reason },
        );
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'failed', message: describeError(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  /** Resolves true if the change was saved, false if it failed (the error is shown). */
  const update = useCallback<UpdateTree>(async (mutate) => {
    try {
      const tree = await repository.update(mutate);
      setState({ status: 'ready', tree });
      setActionError(null);
      return true;
    } catch (error) {
      if (error instanceof CorruptTreeError) setState({ status: 'corrupt', reason: error.reason });
      else setActionError(describeError(error));
      return false;
    }
  }, []);

  return { state, actionError, update };
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
