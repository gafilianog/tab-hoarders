import { useRef, type CSSProperties, type MouseEvent } from 'react';
import { getChildren, isSaveableUrl } from '@/lib/tree/tree';
import { ROOT_ID, type FolderNode, type ItemNode, type NodeId, type Tree, type TreeNode } from '@/lib/tree/types';
import { faviconUrl } from './favicon';
import { ChevronIcon, FolderIcon, MoreIcon } from './icons';
import { RenameInput } from './RenameInput';
import type { Point } from './RowMenu';

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
  onRenameDone: (node: TreeNode, value: string | null) => void;
}

/**
 * Renders the tree as nested lists, so screen readers announce the nesting.
 * Every row has a "more" button and a right-click menu with its actions.
 * Arrow-key navigation inside the tree (PRD FR-43) comes later.
 */
export function TreeView({ tree, actions }: { tree: Tree; actions: TreeActions }) {
  return <ChildList tree={tree} folderId={ROOT_ID} depth={0} actions={actions} />;
}

function ChildList({ tree, folderId, depth, actions }: { tree: Tree; folderId: NodeId; depth: number; actions: TreeActions }) {
  return (
    <ul className="tree">
      {getChildren(tree, folderId).map((node) => (
        <li key={node.id}>
          <NodeRow node={node} depth={depth} actions={actions} />
          {node.type === 'folder' &&
            node.expanded &&
            (node.childIds.length > 0 ? (
              <ChildList tree={tree} folderId={node.id} depth={depth + 1} actions={actions} />
            ) : (
              <p className="placeholder" style={indent(depth + 1)}>
                Empty folder
              </p>
            ))}
        </li>
      ))}
    </ul>
  );
}

function NodeRow({ node, depth, actions }: { node: TreeNode; depth: number; actions: TreeActions }) {
  const menuButton = useRef<HTMLButtonElement>(null);
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
        <img className="icon" src={faviconUrl(node.url)} alt="" width={16} height={16} />
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

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    actions.onMenu({ node, anchor: { x: event.clientX, y: event.clientY }, trigger: menuButton.current });
  };

  const onMenuButton = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    actions.onMenu({ node, anchor: { x: rect.right, y: rect.bottom }, trigger: event.currentTarget });
  };

  const onItemClick = (event: MouseEvent<HTMLAnchorElement>, item: ItemNode) => {
    // Cmd/Ctrl/Shift-click keep the browser's own link behavior (new tab or window).
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    actions.onOpen(item);
  };

  const menuOpen = actions.menuNodeId === node.id;

  return (
    <div className={menuOpen ? 'row menu-open' : 'row'} onContextMenu={onContextMenu}>
      {node.type === 'folder' ? (
        <button
          type="button"
          className="row-main"
          style={indent(depth)}
          aria-expanded={node.expanded}
          title={label}
          onClick={() => actions.onToggle(node)}
        >
          {icons}
          <span className="label">{label}</span>
        </button>
      ) : (
        <a
          className="row-main"
          style={indent(depth)}
          href={isSaveableUrl(node.url) ? node.url : undefined}
          title={`${label}\n${node.url}`}
          onClick={(event) => onItemClick(event, node)}
        >
          {icons}
          <span className="label">{label}</span>
        </a>
      )}
      <button
        ref={menuButton}
        type="button"
        className="row-menu"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={onMenuButton}
      >
        <MoreIcon />
      </button>
    </div>
  );
}

const INDENT_BASE_PX = 8;
const INDENT_STEP_PX = 12;

function indent(depth: number): CSSProperties {
  return { paddingLeft: INDENT_BASE_PX + depth * INDENT_STEP_PX };
}
