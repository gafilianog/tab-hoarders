import { existingFolderOrRoot, listFolders } from '@/lib/tree/tree';
import { ROOT_ID, type NodeId, type Tree } from '@/lib/tree/types';
import { NewFolderIcon } from './icons';

const INDENT = '\u00A0\u00A0\u00A0';

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
        <span>to</span>
        <select value={target} onChange={(event) => onChangeTarget(event.target.value)}>
          <option value={ROOT_ID}>Top level</option>
          {listFolders(tree).map(({ folder, depth }) => (
            <option key={folder.id} value={folder.id}>
              {INDENT.repeat(depth + 1) + folder.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="icon-button" aria-label="New folder" title="New folder" onClick={onNewFolder}>
        <NewFolderIcon />
      </button>
    </div>
  );
}
