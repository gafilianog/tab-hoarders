import { getFolder, getNode } from './tree';
import { ROOT_ID, type NodeId, type Tree, type TreeNode } from './types';

/** A row on screen. The tree is drawn as a flat list of these (PRD NFR-5). */
export interface VisibleRow {
  node: TreeNode;
  /** 0 for the top level. */
  depth: number;
  /** 1-based position among its siblings (aria-posinset). */
  position: number;
  /** Number of siblings, including itself (aria-setsize). */
  siblingCount: number;
}

/** The rows on screen, top to bottom: every node whose folders above it are all expanded. */
export function listVisibleRows(tree: Tree): VisibleRow[] {
  const out: VisibleRow[] = [];
  const pushChildren = (stack: VisibleRow[], folderId: NodeId, depth: number) => {
    const childIds = getFolder(tree, folderId).childIds;
    for (let i = childIds.length - 1; i >= 0; i -= 1) {
      stack.push({ node: getNode(tree, childIds[i]!), depth, position: i + 1, siblingCount: childIds.length });
    }
  };
  const stack: VisibleRow[] = [];
  pushChildren(stack, ROOT_ID, 0);
  while (stack.length > 0) {
    const row = stack.pop()!;
    out.push(row);
    if (row.node.type === 'folder' && row.node.expanded) pushChildren(stack, row.node.id, row.depth + 1);
  }
  return out;
}

export type TreeKeyAction =
  | { type: 'focus'; id: NodeId }
  | { type: 'expand'; id: NodeId }
  | { type: 'collapse'; id: NodeId }
  | { type: 'none' };

/**
 * What a key press on the focused row does, following the WAI-ARIA tree
 * pattern (PRD FR-43):
 * - Up and Down move between rows; Home and End jump to the first and last.
 * - Right opens a closed folder, or moves into an open one.
 * - Left closes an open folder, or moves to the folder above.
 * Enter is not handled here: it clicks the row, which opens a page or
 * toggles a folder.
 */
export function treeKeyAction(rows: readonly VisibleRow[], focusedId: NodeId, key: string): TreeKeyAction {
  const index = rows.findIndex((row) => row.node.id === focusedId);
  const row = rows[index];
  if (!row) return { type: 'none' };
  const focusAt = (i: number): TreeKeyAction => {
    const target = rows[i];
    return target && i !== index ? { type: 'focus', id: target.node.id } : { type: 'none' };
  };

  switch (key) {
    case 'ArrowDown':
      return focusAt(index + 1);
    case 'ArrowUp':
      return focusAt(index - 1);
    case 'Home':
      return focusAt(0);
    case 'End':
      return focusAt(rows.length - 1);
    case 'ArrowRight': {
      const { node } = row;
      if (node.type !== 'folder') return { type: 'none' };
      if (!node.expanded) return { type: 'expand', id: node.id };
      const next = rows[index + 1];
      return next && next.depth === row.depth + 1 ? focusAt(index + 1) : { type: 'none' };
    }
    case 'ArrowLeft': {
      const { node } = row;
      if (node.type === 'folder' && node.expanded) return { type: 'collapse', id: node.id };
      if (node.parentId === null || node.parentId === ROOT_ID) return { type: 'none' };
      return focusAt(rows.findIndex((candidate) => candidate.node.id === node.parentId));
    }
    default:
      return { type: 'none' };
  }
}
