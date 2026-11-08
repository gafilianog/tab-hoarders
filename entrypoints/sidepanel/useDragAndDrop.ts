import { useCallback, useRef, useState, type DragEvent } from 'react';
import { positionInRow, resolveDrop, type DropPosition, type DropTarget } from '@/lib/tree/drop';
import { moveNode } from '@/lib/tree/tree';
import type { NodeId, Tree, TreeNode } from '@/lib/tree/types';
import type { UpdateTree } from './useTree';

/** Marks drags that started on one of our rows, so other drags are ignored. */
const NODE_DRAG_TYPE = 'application/x-tab-hoarders-node';

/** What the row under the pointer shows while dragging. */
export type RowIndicator = DropPosition | 'blocked';

interface Indicator {
  target: DropTarget;
  blocked: boolean;
}

/**
 * Drag and drop for the tree (PRD FR-40 to FR-42), using the browser's
 * built-in HTML drag and drop. The rules for where a drop lands live in
 * lib/tree/drop.ts; this hook only measures the pointer and shows the result.
 */
export function useDragAndDrop(tree: Tree | null, update: UpdateTree) {
  // Handlers read the dragged id from a ref. The state copy is only for
  // styling the dragged row, and is set a moment after the drag starts:
  // re-rendering the dragged element during dragstart can cancel the drag.
  const draggedRef = useRef<NodeId | null>(null);
  const [draggedId, setDraggedId] = useState<NodeId | null>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);

  const showIndicator = useCallback((next: Indicator | null) => {
    setIndicator((current) => (sameIndicator(current, next) ? current : next));
  }, []);

  const finish = useCallback(() => {
    draggedRef.current = null;
    setDraggedId(null);
    setIndicator(null);
  }, []);

  const isOurDrag = (event: DragEvent) =>
    draggedRef.current !== null && event.dataTransfer.types.includes(NODE_DRAG_TYPE);

  /** Shows where a drop on `target` would land and allows or refuses the drop. */
  const hover = (event: DragEvent, target: DropTarget) => {
    const draggedNodeId = draggedRef.current;
    if (!tree || draggedNodeId === null) return;
    const result = resolveDrop(tree, draggedNodeId, target);
    if (!result.ok && result.reason === 'cycle') {
      // Not calling preventDefault refuses the drop; the cursor shows that.
      showIndicator({ target, blocked: true });
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    showIndicator(result.ok ? { target, blocked: false } : null);
  };

  /** Moves the dragged row, checking the drop again against the latest stored tree. */
  const drop = (event: DragEvent, target: DropTarget) => {
    const draggedNodeId = draggedRef.current;
    event.preventDefault();
    finish();
    if (draggedNodeId === null) return;
    void update((latest) => {
      const result = resolveDrop(latest, draggedNodeId, target);
      return result.ok ? moveNode(latest, draggedNodeId, result.parentId, result.index) : latest;
    });
  };

  const rowTarget = (event: DragEvent<HTMLElement>, node: TreeNode): DropTarget => {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = positionInRow(event.clientY - rect.top, rect.height, node.type === 'folder');
    return { kind: 'row', nodeId: node.id, position };
  };

  return {
    draggedId,

    /** What to draw on a row: a line before or after it, a highlight, or a refusal. */
    indicatorFor(nodeId: NodeId): RowIndicator | null {
      if (indicator?.target.kind !== 'row' || indicator.target.nodeId !== nodeId) return null;
      return indicator.blocked ? 'blocked' : indicator.target.position;
    },

    /** True when the drop would go to the end of the top level. */
    endIndicated: indicator?.target.kind === 'end' && !indicator.blocked,

    /** Props for the element the user grabs. */
    source(node: TreeNode) {
      return {
        draggable: true,
        onDragStart: (event: DragEvent) => {
          event.dataTransfer.setData(NODE_DRAG_TYPE, node.id);
          draggedRef.current = node.id;
          window.setTimeout(() => setDraggedId(node.id), 0);
        },
        onDragEnd: finish,
      };
    },

    /** Props for a row that accepts drops before, after or inside it. */
    row(node: TreeNode) {
      return {
        onDragOver: (event: DragEvent<HTMLElement>) => {
          if (!isOurDrag(event)) return;
          event.stopPropagation();
          hover(event, rowTarget(event, node));
        },
        onDrop: (event: DragEvent<HTMLElement>) => {
          if (!isOurDrag(event)) return;
          event.stopPropagation();
          drop(event, rowTarget(event, node));
        },
      };
    },

    /** Props for an "Empty folder" placeholder: dropping there goes inside the folder. */
    placeholder(folderId: NodeId) {
      const target: DropTarget = { kind: 'row', nodeId: folderId, position: 'inside' };
      return {
        onDragOver: (event: DragEvent) => {
          if (!isOurDrag(event)) return;
          event.stopPropagation();
          hover(event, target);
        },
        onDrop: (event: DragEvent) => {
          if (!isOurDrag(event)) return;
          event.stopPropagation();
          drop(event, target);
        },
      };
    },

    /** Props for the space around the tree: dropping there goes to the end of the top level. */
    area: {
      onDragOver: (event: DragEvent) => {
        if (isOurDrag(event)) hover(event, { kind: 'end' });
      },
      onDrop: (event: DragEvent) => {
        if (isOurDrag(event)) drop(event, { kind: 'end' });
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        // Clear the indicator when the pointer leaves the panel, not when it
        // moves between rows inside it.
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) showIndicator(null);
      },
    },
  };
}

export type DragAndDrop = ReturnType<typeof useDragAndDrop>;

function sameIndicator(a: Indicator | null, b: Indicator | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.blocked !== b.blocked || a.target.kind !== b.target.kind) return false;
  if (a.target.kind === 'end' || b.target.kind === 'end') return true;
  return a.target.nodeId === b.target.nodeId && a.target.position === b.target.position;
}
