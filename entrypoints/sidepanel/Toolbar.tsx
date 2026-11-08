import { existingFolderOrRoot, listFolders } from '@/lib/tree/tree';
import type { NodeId, Tree } from '@/lib/tree/types';
import { FolderOptions } from './FolderOptions';
import { NewFolderIcon } from './icons';

/**
 * "Save tab" saves the current tab into the folder picked next to it (PRD
 * FR-20). "New folder" creates a folder at the top level (FR-10).
 */
export function Toolbar({
  tree,
  saveTarget,
  onChangeTarget,
  onSave,
  onNewFolder,
}: {
  tree: Tree;
  saveTarget: NodeId;
  onChangeTarget: (folderId: NodeId) => void;
  onSave: (folderId: NodeId) => void;
  onNewFolder: () => void;
}) {
  // A deleted folder can't be the target, so fall back to the top level.
  const target = existingFolderOrRoot(tree, saveTarget);

  return (
    <div className="toolbar">
      <button type="button" className="button primary" onClick={() => onSave(target)}>
        Save tab
      </button>
      <label className="save-target">
        <span aria-hidden="true">to</span>
        <select aria-label="Folder to save into" value={target} onChange={(event) => onChangeTarget(event.target.value)}>
          <FolderOptions entries={listFolders(tree)} />
        </select>
      </label>
      <button type="button" className="icon-button" aria-label="New folder" title="New folder" onClick={onNewFolder}>
        <NewFolderIcon />
      </button>
    </div>
  );
}
