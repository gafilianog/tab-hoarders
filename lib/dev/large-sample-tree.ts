import { addFolder, addItem, createEmptyTree } from '../tree/tree';
import { ROOT_ID, type NodeId, type Tree } from '../tree/types';

/**
 * A tree at the size PRD NFR-1 is measured against: 100 folders (10 at the
 * top level, each with 9 subfolders) and 1,000 saved pages (10 per folder).
 * Everything starts expanded, the worst case for drawing the panel.
 * Only development builds offer it.
 */
export function buildLargeSampleTree(now: number): Tree {
  let tree = createEmptyTree(now);
  let page = 0;
  const addPages = (folderId: NodeId) => {
    for (let i = 0; i < 10; i += 1) {
      page += 1;
      tree = addItem(tree, folderId, {
        id: `large-item-${page}`,
        title: `Sample page ${page}`,
        url: `https://example.com/page/${page}`,
        createdAt: now,
      });
    }
  };

  for (let top = 1; top <= 10; top += 1) {
    const topId = `large-folder-${top}`;
    tree = addFolder(tree, ROOT_ID, { id: topId, name: `Folder ${top}`, createdAt: now });
    addPages(topId);
    for (let sub = 1; sub <= 9; sub += 1) {
      const subId = `${topId}-${sub}`;
      tree = addFolder(tree, topId, { id: subId, name: `Folder ${top}.${sub}`, createdAt: now });
      addPages(subId);
    }
  }
  return tree;
}
