import { buildSampleTree } from '@/lib/dev/sample-tree';
import { createEmptyTree } from '@/lib/tree/tree';
import type { Tree } from '@/lib/tree/types';

/**
 * Buttons for checking the UI by hand. App only renders this in development
 * builds (`npm run build:dev`), and the production build leaves it out.
 */
export function DevTools({ update }: { update: (mutate: (tree: Tree) => Tree) => Promise<void> }) {
  return (
    <section className="devtools" aria-label="Developer tools">
      <span className="devtools-title">Dev build</span>
      <button type="button" onClick={() => void update(() => buildSampleTree(Date.now()))}>
        Replace with sample data
      </button>
      <button type="button" onClick={() => void update(() => createEmptyTree(Date.now()))}>
        Clear all data
      </button>
    </section>
  );
}
