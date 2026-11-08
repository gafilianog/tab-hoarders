import { getFolder, setExpanded } from '@/lib/tree/tree';
import { ROOT_ID, type FolderNode, type Tree } from '@/lib/tree/types';
import { DevTools } from './DevTools';
import { TreeView } from './TreeView';
import { useTree, type TreeState } from './useTree';

export default function App() {
  const { state, actionError, update } = useTree();

  // Read the folder's state from the latest stored tree, not from the
  // rendered one, so two quick clicks toggle twice instead of once.
  const toggle = (folder: FolderNode) => {
    void update((tree) => setExpanded(tree, folder.id, !getFolder(tree, folder.id).expanded));
  };

  return (
    <main className="panel">
      <Body state={state} onToggle={toggle} />
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {import.meta.env.MODE === 'development' && state.status === 'ready' && <DevTools update={update} />}
    </main>
  );
}

function Body({ state, onToggle }: { state: TreeState; onToggle: (folder: FolderNode) => void }) {
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
      return isEmpty(state.tree) ? <EmptyState /> : <TreeView tree={state.tree} onToggle={onToggle} />;
  }
}

function EmptyState() {
  return (
    <div className="message">
      <p className="message-title">No folders yet</p>
      <p>Create a folder, or save the tab you're on, to start organizing your pages here.</p>
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
