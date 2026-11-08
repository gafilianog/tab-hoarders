import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { isSaveableUrl } from '@/lib/tree/tree';
import type { FolderNode, ItemNode, NodeId, Tree, TreeNode } from '@/lib/tree/types';
import { listVisibleRows, treeKeyAction, type VisibleRow } from '@/lib/tree/visible-rows';
import { faviconUrl } from './favicon';
import { ChevronIcon, FolderIcon, MoreIcon } from './icons';
import { RenameInput } from './RenameInput';
import type { Point } from './RowMenu';
import type { DragAndDrop } from './useDragAndDrop';

export interface MenuRequest {
  node: TreeNode;
  anchor: Point;
  /** Gets focus back when the menu closes. */
  trigger: HTMLElement | null;
}

export interface TreeActions {
  renamingId: NodeId | null;
  menuNodeId: NodeId | null;
  onToggle: (folder: FolderNode) => void;
  onOpen: (item: ItemNode) => void;
  onMenu: (request: MenuRequest) => void;
  onStartRename: (node: TreeNode) => void;
  onRenameDone: (node: TreeNode, value: string | null) => void;
  onDelete: (node: TreeNode) => void;
  dnd: DragAndDrop;
}

/**
 * The tree as an ARIA tree (PRD NFR-5, FR-43): a flat list of rows, each a
 * treeitem with its level and position, so screen readers announce the
 * nesting. Only one row is in the Tab order; the keys below move between rows.
 *
 * Up/Down/Home/End move, Right/Left open, close or move in and out of
 * folders, Enter or Space opens a page or toggles a folder, F2 renames,
 * Delete or Backspace deletes, and Shift+F10 or the menu key opens the
 * row's menu.
 */
export function TreeView({ tree, actions }: { tree: Tree; actions: TreeActions }) {
  const rows = useMemo(() => listVisibleRows(tree), [tree]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<NodeId | null>(null);
  const lastFocusedIndex = useRef(0);

  const tabStopId = rows.some((row) => row.node.id === focusedId) ? focusedId : (rows[0]?.node.id ?? null);

  const elementFor = (id: NodeId) =>
    containerRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`) ?? null;

  const focusRow = (id: NodeId) => {
    setFocusedId(id);
    elementFor(id)?.focus();
  };

  const focusIsLost = () => document.activeElement === null || document.activeElement === document.body;

  // When the focused row disappears (deleted here or in another window, or
  // hidden by collapsing its folder), move focus to the row now in its place
  // instead of losing it.
  useEffect(() => {
    const index = rows.findIndex((row) => row.node.id === focusedId);
    if (index >= 0) {
      lastFocusedIndex.current = index;
      return;
    }
    if (focusedId === null) return;
    const fallback = rows[Math.min(lastFocusedIndex.current, rows.length - 1)];
    if (fallback && focusIsLost()) focusRow(fallback.node.id);
    else setFocusedId(null);
    // focusRow only reads the DOM and sets state, so it is not a dependency.
  }, [rows, focusedId]);

  // After renaming with Enter or Escape, put focus back on the row.
  const previousRenamingId = useRef<NodeId | null>(null);
  useEffect(() => {
    const previous = previousRenamingId.current;
    previousRenamingId.current = actions.renamingId;
    if (previous !== null && actions.renamingId === null && focusIsLost()) elementFor(previous)?.focus();
  }, [actions.renamingId]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only keys pressed on a row; the rename field handles its own keys.
    const element = event.target;
    if (!(element instanceof HTMLElement) || element.getAttribute('role') !== 'treeitem') return;
    const row = rows.find((candidate) => candidate.node.id === element.dataset.nodeId);
    if (!row) return;
    const { node } = row;

    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      actions.onMenu({ node, anchor: { x: rect.left + 24, y: rect.bottom }, trigger: element });
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      actions.onDelete(node);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'F2') {
      event.preventDefault();
      actions.onStartRename(node);
      return;
    }
    // Enter on a page is left to the link, which opens it through its click handler.
    if (event.key === ' ' || (event.key === 'Enter' && node.type === 'folder')) {
      event.preventDefault();
      if (node.type === 'folder') actions.onToggle(node);
      else actions.onOpen(node);
      return;
    }

    const action = treeKeyAction(rows, node.id, event.key);
    if (action.type === 'none') return;
    event.preventDefault();
    if (action.type === 'focus') {
      focusRow(action.id);
      return;
    }
    const folder = tree.nodes[action.id];
    if (folder?.type === 'folder') actions.onToggle(folder);
  };

  return (
    <div ref={containerRef} role="tree" aria-label="Saved folders and pages" className="tree" onKeyDown={onKeyDown}>
      {rows.map((row) => (
        <Fragment key={row.node.id}>
          <NodeRow row={row} tabbable={row.node.id === tabStopId} onFocusRow={setFocusedId} actions={actions} />
          {row.node.type === 'folder' && row.node.expanded && row.node.childIds.length === 0 && (
            <p className="placeholder" aria-hidden="true" style={indent(row.depth + 1)} {...actions.dnd.placeholder(row.node.id)}>
              Empty folder
            </p>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function NodeRow({
  row,
  tabbable,
  onFocusRow,
  actions,
}: {
  row: VisibleRow;
  tabbable: boolean;
  onFocusRow: (id: NodeId) => void;
  actions: TreeActions;
}) {
  const { node, depth } = row;
  const label = node.type === 'folder' ? node.name : node.title;
  const icons =
    node.type === 'folder' ? (
      <>
        <ChevronIcon open={node.expanded} />
        <FolderIcon />
      </>
    ) : (
      <>
        <span className="chevron" aria-hidden="true" />
        {/* Not draggable on its own, so a drag that starts on the icon moves the whole row. */}
        <img
          className="icon"
          src={faviconUrl(node.url)}
          alt=""
          width={16}
          height={16}
          loading="lazy"
          draggable={false}
        />
      </>
    );

  if (actions.renamingId === node.id) {
    return (
      <div className="row renaming" style={indent(depth)}>
        {icons}
        <RenameInput
          initial={label}
          label={node.type === 'folder' ? 'Folder name' : 'Page title'}
          onDone={(value) => actions.onRenameDone(node, value)}
        />
      </div>
    );
  }

  const treeitemIn = (element: Element | null) => element?.querySelector<HTMLElement>('[role="treeitem"]') ?? null;

  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    actions.onMenu({ node, anchor: { x: event.clientX, y: event.clientY }, trigger: treeitemIn(event.currentTarget) });
  };

  const onMenuButton = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    actions.onMenu({ node, anchor: { x: rect.right, y: rect.bottom }, trigger: treeitemIn(event.currentTarget.parentElement) });
  };

  const onItemClick = (event: MouseEvent<HTMLAnchorElement>, item: ItemNode) => {
    // Cmd/Ctrl/Shift-click keep the browser's own link behavior (new tab or window).
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    actions.onOpen(item);
  };

  const { dnd } = actions;
  const menuOpen = actions.menuNodeId === node.id;
  const drop = dnd.indicatorFor(node.id);
  const classes = ['row'];
  if (menuOpen) classes.push('menu-open');
  if (dnd.draggedId === node.id) classes.push('dragging');
  if (drop) classes.push(`drop-${drop}`);

  // A line drawn below an expanded folder with children sits above its
  // first child, so it is indented one level deeper (see lib/tree/drop.ts).
  const lineDepth = drop === 'after' && node.type === 'folder' && node.expanded && node.childIds.length > 0 ? depth + 1 : depth;
  const rowStyle = { '--drop-indent': `${indentPx(lineDepth)}px` } as CSSProperties;

  const treeitem = {
    role: 'treeitem',
    'aria-level': depth + 1,
    'aria-posinset': row.position,
    'aria-setsize': row.siblingCount,
    'data-node-id': node.id,
    tabIndex: tabbable ? 0 : -1,
    className: 'row-main',
    style: indent(depth),
    onFocus: () => onFocusRow(node.id),
    ...dnd.source(node),
  };

  return (
    <div className={classes.join(' ')} style={rowStyle} onContextMenu={onContextMenu} {...dnd.row(node)}>
      {node.type === 'folder' ? (
        <div {...treeitem} aria-expanded={node.expanded} title={label} onClick={() => actions.onToggle(node)}>
          {icons}
          <span className="label">{label}</span>
        </div>
      ) : (
        <a
          {...treeitem}
          href={isSaveableUrl(node.url) ? node.url : undefined}
          title={`${label}\n${node.url}`}
          onClick={(event) => onItemClick(event, node)}
        >
          {icons}
          <span className="label">{label}</span>
        </a>
      )}
      {/* For the mouse. Keyboard users open the same menu with Shift+F10 on the row. */}
      <button type="button" className="row-menu" tabIndex={-1} aria-hidden="true" title="More actions" onClick={onMenuButton}>
        <MoreIcon />
      </button>
    </div>
  );
}

const INDENT_BASE_PX = 8;
const INDENT_STEP_PX = 12;

function indentPx(depth: number): number {
  return INDENT_BASE_PX + depth * INDENT_STEP_PX;
}

function indent(depth: number): CSSProperties {
  return { paddingLeft: indentPx(depth) };
}
