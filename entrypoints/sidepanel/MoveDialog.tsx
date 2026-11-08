import { useState } from 'react';
import { listMoveTargets } from '@/lib/tree/tree';
import { ROOT_ID, type NodeId, type Tree, type TreeNode } from '@/lib/tree/types';
import { FolderOptions } from './FolderOptions';
import { Modal } from './Modal';

/**
 * "Move to…" (PRD FR-44): moves a row without dragging, so it works from the
 * keyboard. A folder's own subfolders are not offered.
 */
export function MoveDialog({
  tree,
  node,
  onMove,
  onCancel,
}: {
  tree: Tree;
  node: TreeNode;
  onMove: (folderId: NodeId) => void;
  onCancel: () => void;
}) {
  const currentParent = node.parentId ?? ROOT_ID;
  const [target, setTarget] = useState<NodeId>(currentParent);
  const name = node.type === 'folder' ? node.name : node.title;

  return (
    <Modal title={`Move "${name}"`} onCancel={onCancel}>
      <label className="field">
        <span>Move to</span>
        <select value={target} onChange={(event) => setTarget(event.target.value)}>
          <FolderOptions entries={listMoveTargets(tree, node.id)} />
        </select>
      </label>
      <p className="hint">It goes to the end of the folder you pick.</p>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="button primary"
          disabled={target === currentParent}
          onClick={() => onMove(target)}
        >
          Move
        </button>
      </div>
    </Modal>
  );
}
