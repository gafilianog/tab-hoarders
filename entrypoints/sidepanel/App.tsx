import { useState } from 'react';
import { needsOpenAllConfirmation, openAll } from '@/lib/tabs/open-all';
import { getCurrentPage, openOrFocus, type CurrentPage } from '@/lib/tabs/tab-actions';
import {
  addFolder,
  addItem,
  collectItems,
  countDescendants,
  existingFolderOrRoot,
  expandPath,
  getFolder,
  getNode,
  hasNode,
  moveNode,
  reinsertItem,
  removeNode,
  renameNode,
  setExpanded,
} from '@/lib/tree/tree';
import { ROOT_ID, type FolderNode, type ItemNode, type NodeId, type Tree, type TreeNode } from '@/lib/tree/types';
import { ConfirmDialog } from './ConfirmDialog';
import { DevTools } from './DevTools';
import { MoveDialog } from './MoveDialog';
import { RowMenu, type MenuEntry } from './RowMenu';
import { describeFolderContents, describeOpenAllResult } from './text';
import { ToastRegion, useToast } from './Toast';
import { Toolbar } from './Toolbar';
import { TreeView, type MenuRequest, type TreeActions } from './TreeView';
import { useDragAndDrop } from './useDragAndDrop';
import { useSaveTarget } from './useSaveTarget';
import { describeError, useTree, type TreeState } from './useTree';

const NEW_FOLDER_NAME = 'New folder';

export default function App() {
  const { state, actionError, update } = useTree();
  const [saveTarget, chooseSaveTarget] = useSaveTarget();
  const { toast, showToast, dismissToast } = useToast();
  const [renamingId, setRenamingId] = useState<NodeId | null>(null);
  const [menu, setMenu] = useState<MenuRequest | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FolderNode | null>(null);
  const [pendingOpenAll, setPendingOpenAll] = useState<{ folder: FolderNode; urls: string[] } | null>(null);
  const [movingId, setMovingId] = useState<NodeId | null>(null);

  const tree = state.status === 'ready' ? state.tree : null;
  const dnd = useDragAndDrop(tree, update);
  // Another window may delete the row while its dialog is open here.
  const movingNode = movingId !== null && tree && hasNode(tree, movingId) ? getNode(tree, movingId) : null;

  // Each change reads the latest stored tree inside `update`, not the
  // rendered one, so quick repeated clicks never act on stale data.

  const toggleFolder = (folder: FolderNode) => {
    void update((t) => setExpanded(t, folder.id, !getFolder(t, folder.id).expanded));
  };

  /** FR-10: creates "New folder" and starts renaming it right away. */
  const createFolder = async (parentId: NodeId) => {
    const id = crypto.randomUUID();
    const saved = await update((t) => {
      const parent = existingFolderOrRoot(t, parentId);
      return expandPath(addFolder(t, parent, { id, name: NEW_FOLDER_NAME, createdAt: Date.now() }), parent);
    });
    if (saved) setRenamingId(id);
  };

  /** FR-11, FR-24. An empty name is rejected and the old name kept. */
  const finishRename = (node: TreeNode, value: string | null) => {
    setRenamingId(null);
    if (value === null) return;
    const name = value.trim();
    const current = node.type === 'folder' ? node.name : node.title;
    if (name === current) return;
    if (name === '') {
      showToast({ message: "A name can't be empty, so the old name was kept." });
      return;
    }
    void update((t) => renameNode(t, node.id, name));
  };

  /** FR-20, FR-22: saves the active tab into a folder and shows where it went. */
  const saveCurrentTab = async (folderId: NodeId) => {
    let page: CurrentPage;
    try {
      page = await getCurrentPage(browser.tabs);
    } catch (error) {
      showToast({ message: `Couldn't read the current tab: ${describeError(error)}` });
      return;
    }
    if (!page.ok) {
      showToast({
        message:
          page.reason === 'unsupported-url'
            ? "This page can't be saved. Only web pages (http and https) can be saved."
            : 'There is no tab to save in this window.',
      });
      return;
    }

    const { url, title } = page;
    const id = crypto.randomUUID();
    const target = { id: ROOT_ID as NodeId, name: '' };
    const saved = await update((t) => {
      target.id = existingFolderOrRoot(t, folderId);
      target.name = target.id === ROOT_ID ? 'the top level' : getFolder(t, target.id).name;
      return expandPath(addItem(t, target.id, { id, url, title, createdAt: Date.now() }), target.id);
    });
    if (!saved) return;
    chooseSaveTarget(target.id);
    showToast({ message: `Saved to ${target.name}` });
  };

  /** FR-23 */
  const openItem = (item: ItemNode) => {
    openOrFocus(browser.tabs, item.url).catch((error: unknown) =>
      showToast({ message: `Couldn't open the page: ${describeError(error)}` }),
    );
  };

  /** FR-25 / D9: items are deleted at once, with Undo. */
  const deleteItem = async (item: ItemNode) => {
    const removed: { item?: ItemNode; index?: number } = {};
    const saved = await update((t) => {
      const latest = getNode(t, item.id) as ItemNode;
      removed.item = latest;
      removed.index = getFolder(t, latest.parentId).childIds.indexOf(latest.id);
      return removeNode(t, item.id);
    });
    const { item: removedItem, index } = removed;
    if (!saved || !removedItem || index === undefined) return;
    showToast({
      message: `Deleted "${removedItem.title}"`,
      action: { label: 'Undo', run: () => void update((t) => reinsertItem(t, removedItem, index)) },
    });
  };

  /** FR-12 / D9: a folder with anything inside asks first. */
  const requestDelete = (node: TreeNode) => {
    if (node.type === 'item') {
      void deleteItem(node);
      return;
    }
    if (!tree) return;
    const { folders, items } = countDescendants(tree, node.id);
    if (folders + items === 0) void update((t) => (hasNode(t, node.id) ? removeNode(t, node.id) : t));
    else setPendingDelete(node);
  };

  const confirmFolderDelete = () => {
    const folder = pendingDelete;
    setPendingDelete(null);
    if (folder) void update((t) => (hasNode(t, folder.id) ? removeNode(t, folder.id) : t));
  };

  /** FR-30, FR-31, FR-33: every page in the folder and its subfolders, as background tabs. */
  const runOpenAll = (urls: string[]) => {
    openAll(browser.tabs, urls).then(
      (result) => showToast({ message: describeOpenAllResult(result) }),
      (error: unknown) => showToast({ message: `Couldn't open the pages: ${describeError(error)}` }),
    );
  };

  /** FR-32 / D8: more than 20 tabs asks first. */
  const requestOpenAll = (folder: FolderNode) => {
    if (!tree || !hasNode(tree, folder.id)) return;
    const urls = collectItems(tree, folder.id).map((item) => item.url);
    if (urls.length === 0) {
      showToast({ message: `"${folder.name}" has no saved pages to open.` });
      return;
    }
    if (needsOpenAllConfirmation(urls.length)) setPendingOpenAll({ folder, urls });
    else runOpenAll(urls);
  };

  const confirmOpenAll = () => {
    const pending = pendingOpenAll;
    setPendingOpenAll(null);
    if (pending) runOpenAll(pending.urls);
  };

  /** FR-44: moves a row to the end of a folder without dragging. */
  const moveTo = async (nodeId: NodeId, folderId: NodeId) => {
    setMovingId(null);
    const target = { name: '' };
    const saved = await update((t) => {
      const parent = existingFolderOrRoot(t, folderId);
      target.name = parent === ROOT_ID ? 'the top level' : getFolder(t, parent).name;
      return expandPath(moveNode(t, nodeId, parent), parent);
    });
    if (saved) showToast({ message: `Moved to ${target.name}` });
  };

  const menuEntries = (node: TreeNode): MenuEntry[] => {
    const common: MenuEntry[] = [
      { label: 'Move to…', run: () => setMovingId(node.id) },
      { label: 'Rename', run: () => setRenamingId(node.id) },
      { label: 'Delete', danger: true, run: () => requestDelete(node) },
    ];
    if (node.type === 'item') return common;
    return [
      { label: 'Open all pages', run: () => requestOpenAll(node) },
      { label: 'Save current tab here', run: () => void saveCurrentTab(node.id) },
      { label: 'New folder inside', run: () => void createFolder(node.id) },
      ...common,
    ];
  };

  const closeMenu = () => {
    const trigger = menu?.trigger;
    setMenu(null);
    trigger?.focus();
  };

  const treeActions: TreeActions = {
    renamingId,
    menuNodeId: menu?.node.id ?? null,
    onToggle: toggleFolder,
    onOpen: openItem,
    onMenu: setMenu,
    onStartRename: (node) => setRenamingId(node.id),
    onRenameDone: finishRename,
    onDelete: requestDelete,
    dnd,
  };

  return (
    <main className="panel">
      {tree && (
        <Toolbar
          tree={tree}
          saveTarget={saveTarget}
          onChangeTarget={chooseSaveTarget}
          onSave={(folderId) => void saveCurrentTab(folderId)}
          onNewFolder={() => void createFolder(ROOT_ID)}
        />
      )}
      {/* Fills the rest of the panel, so a drop below the last row goes to the end of the top level. */}
      <div className="tree-area" {...dnd.area}>
        <Body state={state} actions={treeActions} />
        {dnd.endIndicated && <div className="drop-end" aria-hidden="true" />}
      </div>
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {import.meta.env.MODE === 'development' && tree && <DevTools update={update} />}
      {/* Another window may delete the row while its menu is open here. */}
      {menu && tree && hasNode(tree, menu.node.id) && (
        <RowMenu
          anchor={menu.anchor}
          label={`Actions for ${menu.node.type === 'folder' ? menu.node.name : menu.node.title}`}
          entries={menuEntries(menu.node)}
          onClose={closeMenu}
        />
      )}
      {pendingDelete && tree && hasNode(tree, pendingDelete.id) && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"?`}
          message={describeFolderContents(countDescendants(tree, pendingDelete.id))}
          confirmLabel="Delete folder"
          onConfirm={confirmFolderDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {pendingOpenAll && (
        <ConfirmDialog
          title={`Open ${pendingOpenAll.urls.length} tabs?`}
          message={`Every page in "${pendingOpenAll.folder.name}" and its subfolders opens as a background tab in this window.`}
          confirmLabel={`Open ${pendingOpenAll.urls.length} tabs`}
          tone="primary"
          onConfirm={confirmOpenAll}
          onCancel={() => setPendingOpenAll(null)}
        />
      )}
      {movingNode && tree && (
        <MoveDialog
          tree={tree}
          node={movingNode}
          onMove={(folderId) => void moveTo(movingNode.id, folderId)}
          onCancel={() => setMovingId(null)}
        />
      )}
      <ToastRegion toast={toast} onDismiss={dismissToast} />
    </main>
  );
}

function Body({ state, actions }: { state: TreeState; actions: TreeActions }) {
  switch (state.status) {
    case 'loading':
      return <p className="message">Loading…</p>;
    case 'corrupt':
      return (
        <ErrorNotice
          title="Your saved folders couldn't be read."
          detail={`Nothing has been changed or deleted. Details: ${state.reason}`}
        />
      );
    case 'failed':
      return <ErrorNotice title="Storage couldn't be opened." detail={state.message} />;
    case 'ready':
      return isEmpty(state.tree) ? <EmptyState /> : <TreeView tree={state.tree} actions={actions} />;
  }
}

function EmptyState() {
  return (
    <div className="message">
      <p className="message-title">No folders yet</p>
      <p>Use Save tab to keep the page you're on, or the folder button to create a folder.</p>
    </div>
  );
}

function ErrorNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="error" role="alert">
      <p className="message-title">{title}</p>
      <p>{detail}</p>
    </div>
  );
}

function isEmpty(tree: Tree): boolean {
  const root = tree.nodes[ROOT_ID];
  return root?.type === 'folder' && root.childIds.length === 0;
}
