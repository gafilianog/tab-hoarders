import { addFolder, addItem, createEmptyTree, setExpanded } from '../tree/tree';
import { ROOT_ID, type NodeId, type Tree } from '../tree/types';

/**
 * Demo data for checking the UI by hand. Only development builds offer it.
 * Covers nesting, a collapsed folder, an empty folder, a 20-level chain
 * (PRD FR-14) and a title too long for the panel.
 */
export function buildSampleTree(now: number): Tree {
  let tree = createEmptyTree(now);
  let counter = 0;

  const folder = (parentId: NodeId, name: string): NodeId => {
    counter += 1;
    const id = `sample-folder-${counter}`;
    tree = addFolder(tree, parentId, { id, name, createdAt: now });
    return id;
  };
  const item = (parentId: NodeId, title: string, url: string): void => {
    counter += 1;
    tree = addItem(tree, parentId, { id: `sample-item-${counter}`, title, url, createdAt: now });
  };

  const reading = folder(ROOT_ID, 'Reading list');
  item(reading, 'Chrome Side Panel API', 'https://developer.chrome.com/docs/extensions/reference/api/sidePanel');
  item(reading, 'WXT', 'https://wxt.dev/');
  item(reading, 'React', 'https://react.dev/');

  const work = folder(ROOT_ID, 'Work');
  const project = folder(work, 'Project A');
  item(project, 'GitHub', 'https://github.com/');
  item(project, 'MDN Web Docs', 'https://developer.mozilla.org/');
  const archive = folder(work, 'Archive (starts collapsed)');
  item(archive, 'Hacker News', 'https://news.ycombinator.com/');
  tree = setExpanded(tree, archive, false);
  folder(work, 'Empty folder');

  let parent = folder(ROOT_ID, 'Deep nesting, level 1');
  for (let level = 2; level <= 20; level += 1) parent = folder(parent, `Level ${level}`);
  item(
    parent,
    'A page saved 20 folders deep, with a title long enough to be cut off at the edge of the panel',
    'https://example.com/',
  );

  item(ROOT_ID, 'A page saved at the top level', 'https://www.wikipedia.org/');
  return tree;
}
