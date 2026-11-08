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
        if (!cancelled) setState({ status: 'failed', message: describe(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (mutate: (tree: Tree) => Tree): Promise<void> => {
    try {
      const tree = await repository.update(mutate);
      setState({ status: 'ready', tree });
      setActionError(null);
    } catch (error) {
      if (error instanceof CorruptTreeError) setState({ status: 'corrupt', reason: error.reason });
      else setActionError(describe(error));
    }
  }, []);

  return { state, actionError, update };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
