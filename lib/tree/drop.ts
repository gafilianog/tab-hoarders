import { getFolder, getNode, hasNode, isAncestor } from './tree';
import { ROOT_ID, type NodeId, type Tree } from './types';

// Where a dragged row would land (PRD FR-40 to FR-42). Pure functions, so the
// rules are unit-tested without a browser; the UI only measures the pointer.

/** Which part of the row under the pointer the drop is aimed at. */
export type DropPosition = 'before' | 'after' | 'inside';

/** A row the pointer is over, or the empty space below the tree. */
export type DropTarget = { kind: 'row'; nodeId: NodeId; position: DropPosition } | { kind: 'end' };

export type DropResult =
  | { ok: true; parentId: NodeId; index: number }
  /** Valid but changes nothing, such as dropping a row right where it is. */
  | { ok: false; reason: 'no-change' }
  /** Not allowed: a folder into itself or one of its subfolders (FR-15). */
  | { ok: false; reason: 'cycle' }
  | { ok: false; reason: 'missing' };

/**
 * Picks the drop position from the pointer's height within a row.
 * `offsetY` is measured from the row's top edge.
 *
 * Folder rows have three zones: the top quarter drops before the folder, the
 * bottom quarter after it, and the middle into it. Page rows have two halves.
 */
export function positionInRow(offsetY: number, rowHeight: number, isFolder: boolean): DropPosition {
  const ratio = rowHeight > 0 ? offsetY / rowHeight : 0.5;
  if (!isFolder) return ratio < 0.5 ? 'before' : 'after';
  if (ratio < 0.25) return 'before';
  if (ratio >= 0.75) return 'after';
  return 'inside';
}

/**
 * Works out where `draggedId` would move for a drop on `target`, as the
 * arguments for moveNode (its index is the position after the move).
 *
 * - "inside" a folder appends to the end of it, even if it is collapsed (FR-41).
 * - "after" an expanded folder that has children puts the row first inside
 *   it, because that's where the drop line appears: between the folder and
 *   its first child.
 * - "end" appends to the end of the top level.
 */
export function resolveDrop(tree: Tree, draggedId: NodeId, target: DropTarget): DropResult {
  if (draggedId === ROOT_ID || !hasNode(tree, draggedId)) return { ok: false, reason: 'missing' };
  if (target.kind === 'row' && !hasNode(tree, target.nodeId)) return { ok: false, reason: 'missing' };
  // The pointer starts over the dragged row itself; that is never a move.
  if (target.kind === 'row' && target.nodeId === draggedId) return { ok: false, reason: 'no-change' };

  const destination = destinationFor(tree, draggedId, target);
  if (destination.parentId === draggedId || isAncestor(tree, draggedId, destination.parentId)) {
    return { ok: false, reason: 'cycle' };
  }

  const dragged = getNode(tree, draggedId);
  if (dragged.parentId === destination.parentId) {
    const currentIndex = getFolder(tree, destination.parentId).childIds.indexOf(draggedId);
    if (currentIndex === destination.index) return { ok: false, reason: 'no-change' };
  }
  return { ok: true, ...destination };
}

/** The new parent and index, with the dragged row already taken out of its old place. */
function destinationFor(tree: Tree, draggedId: NodeId, target: DropTarget): { parentId: NodeId; index: number } {
  if (target.kind === 'end') {
    return { parentId: ROOT_ID, index: siblingsWithout(tree, ROOT_ID, draggedId).length };
  }

  const node = getNode(tree, target.nodeId);
  if (node.type === 'folder') {
    if (target.position === 'inside') {
      return { parentId: node.id, index: siblingsWithout(tree, node.id, draggedId).length };
    }
    if (target.position === 'after' && node.expanded && node.childIds.length > 0) {
      return { parentId: node.id, index: 0 };
    }
  }

  // Before or after the row, among its siblings.
  const parentId = node.parentId ?? ROOT_ID;
  const siblings = siblingsWithout(tree, parentId, draggedId);
  const targetIndex = siblings.indexOf(node.id);
  return { parentId, index: target.position === 'before' ? targetIndex : targetIndex + 1 };
}

function siblingsWithout(tree: Tree, folderId: NodeId, draggedId: NodeId): NodeId[] {
  return getFolder(tree, folderId).childIds.filter((id) => id !== draggedId);
}
