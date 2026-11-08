import type { CSSProperties } from 'react';
import { getChildren } from '@/lib/tree/tree';
import { ROOT_ID, type FolderNode, type ItemNode, type NodeId, type Tree } from '@/lib/tree/types';
import { faviconUrl } from './favicon';

interface TreeViewProps {
  tree: Tree;
  onToggle: (folder: FolderNode) => void;
}

/**
 * Renders the tree as nested lists, so screen readers announce the nesting.
 * Keyboard navigation inside the tree (PRD FR-43) comes later; for now folder
 * rows are plain buttons reachable with Tab.
 */
export function TreeView({ tree, onToggle }: TreeViewProps) {
  return <ChildList tree={tree} folderId={ROOT_ID} depth={0} onToggle={onToggle} />;
}

interface ChildListProps extends TreeViewProps {
  folderId: NodeId;
  depth: number;
}

function ChildList({ tree, folderId, depth, onToggle }: ChildListProps) {
  return (
    <ul className="tree">
      {getChildren(tree, folderId).map((node) => (
        <li key={node.id}>
          {node.type === 'folder' ? (
            <>
              <FolderRow folder={node} depth={depth} onToggle={onToggle} />
              {node.expanded &&
                (node.childIds.length > 0 ? (
                  <ChildList tree={tree} folderId={node.id} depth={depth + 1} onToggle={onToggle} />
                ) : (
                  <p className="row empty-folder" style={indent(depth + 1)}>
                    Empty folder
                  </p>
                ))}
            </>
          ) : (
            <ItemRow item={node} depth={depth} />
          )}
        </li>
      ))}
    </ul>
  );
}

function FolderRow({ folder, depth, onToggle }: { folder: FolderNode; depth: number; onToggle: (folder: FolderNode) => void }) {
  return (
    <button
      type="button"
      className="row folder"
      style={indent(depth)}
      aria-expanded={folder.expanded}
      title={folder.name}
      onClick={() => onToggle(folder)}
    >
      <ChevronIcon open={folder.expanded} />
      <FolderIcon />
      <span className="label">{folder.name}</span>
    </button>
  );
}

function ItemRow({ item, depth }: { item: ItemNode; depth: number }) {
  return (
    <div className="row item" style={indent(depth)} title={`${item.title}\n${item.url}`}>
      <span className="chevron" aria-hidden="true" />
      <img className="icon" src={faviconUrl(item.url)} alt="" width={16} height={16} />
      <span className="label">{item.title}</span>
    </div>
  );
}

const INDENT_BASE_PX = 8;
const INDENT_STEP_PX = 12;

function indent(depth: number): CSSProperties {
  return { paddingLeft: INDENT_BASE_PX + depth * INDENT_STEP_PX };
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={open ? 'chevron open' : 'chevron'} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="icon folder-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M1 3.5C1 2.7 1.7 2 2.5 2h3.6l1.6 1.6h5.8c.8 0 1.5.7 1.5 1.5v7.4c0 .8-.7 1.5-1.5 1.5h-11C1.7 14 1 13.3 1 12.5z"
      />
    </svg>
  );
}
