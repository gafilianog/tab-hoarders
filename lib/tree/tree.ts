import {
  ROOT_ID,
  SCHEMA_VERSION,
  type FolderNode,
  type ItemNode,
  type NodeId,
  type Tree,
  type TreeNode,
} from './types';

// Pure tree operations. None of them touch browser APIs or mutate their
// input: each returns a new Tree, so callers (and React) can compare by
// reference, and a failed operation leaves the old tree untouched.

export type TreeErrorCode =
  | 'NOT_FOUND'
  | 'NOT_A_FOLDER'
  | 'ROOT_IMMUTABLE'
  | 'CYCLE'
  | 'DUPLICATE_ID'
  | 'INVALID_NAME'
  | 'INVALID_URL';

export class TreeError extends Error {
  readonly code: TreeErrorCode;

  constructor(code: TreeErrorCode, message: string) {
    super(message);
    this.name = 'TreeError';
    this.code = code;
  }
}

export function createEmptyTree(createdAt: number): Tree {
  const root: FolderNode = {
    type: 'folder',
    id: ROOT_ID,
    parentId: null,
    name: '',
    childIds: [],
    expanded: true,
    createdAt,
  };
  return { schemaVersion: SCHEMA_VERSION, nodes: { [ROOT_ID]: root } };
}

export function getNode(tree: Tree, id: NodeId): TreeNode {
  const node = Object.hasOwn(tree.nodes, id) ? tree.nodes[id] : undefined;
  if (!node) throw new TreeError('NOT_FOUND', `No node with id "${id}"`);
  return node;
}

export function getFolder(tree: Tree, id: NodeId): FolderNode {
  const node = getNode(tree, id);
  if (node.type !== 'folder') {
    throw new TreeError('NOT_A_FOLDER', `Node "${id}" is not a folder`);
  }
  return node;
}

export function getChildren(tree: Tree, folderId: NodeId): TreeNode[] {
  return getFolder(tree, folderId).childIds.map((id) => getNode(tree, id));
}

/** Only http and https pages can be saved (PRD FR-22). */
export function isSaveableUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** True if `ancestorId` is above `nodeId` in the tree. */
export function isAncestor(tree: Tree, ancestorId: NodeId, nodeId: NodeId): boolean {
  let current = getNode(tree, nodeId).parentId;
  while (current !== null) {
    if (current === ancestorId) return true;
    current = getNode(tree, current).parentId;
  }
  return false;
}

export interface NewFolder {
  id: NodeId;
  name: string;
  createdAt: number;
}

/** Adds a folder. `index` is its position among the parent's children; omitted means last. */
export function addFolder(tree: Tree, parentId: NodeId, folder: NewFolder, index?: number): Tree {
  const parent = getFolder(tree, parentId);
  assertNewId(tree, folder.id);
  const node: FolderNode = {
    type: 'folder',
    id: folder.id,
    parentId,
    name: cleanName(folder.name),
    childIds: [],
    expanded: true,
    createdAt: folder.createdAt,
  };
  return withNewChild(tree, parent, node, index);
}

export interface NewItem {
  id: NodeId;
  url: string;
  title: string;
  createdAt: number;
}

/** Adds a saved URL. An empty title falls back to the URL. */
export function addItem(tree: Tree, parentId: NodeId, item: NewItem, index?: number): Tree {
  const parent = getFolder(tree, parentId);
  assertNewId(tree, item.id);
  if (!isSaveableUrl(item.url)) {
    throw new TreeError('INVALID_URL', `Only http and https pages can be saved: "${item.url}"`);
  }
  const node: ItemNode = {
    type: 'item',
    id: item.id,
    parentId,
    url: item.url,
    title: item.title.trim() || item.url,
    createdAt: item.createdAt,
  };
  return withNewChild(tree, parent, node, index);
}

/** Renames a folder or an item. Empty names are rejected (PRD FR-11, FR-24). */
export function renameNode(tree: Tree, id: NodeId, name: string): Tree {
  assertNotRoot(id);
  const node = getNode(tree, id);
  const clean = cleanName(name);
  const renamed: TreeNode = node.type === 'folder' ? { ...node, name: clean } : { ...node, title: clean };
  return withNode(tree, renamed);
}

export function setExpanded(tree: Tree, folderId: NodeId, expanded: boolean): Tree {
  const folder = getFolder(tree, folderId);
  if (folder.expanded === expanded) return tree;
  return withNode(tree, { ...folder, expanded });
}

/** Deletes a node and, for a folder, everything inside it. */
export function removeNode(tree: Tree, id: NodeId): Tree {
  assertNotRoot(id);
  const node = getNode(tree, id);
  const parent = parentOf(tree, node);
  const nodes = { ...tree.nodes };
  for (const removedId of subtreeIds(tree, id)) delete nodes[removedId];
  nodes[parent.id] = { ...parent, childIds: parent.childIds.filter((childId) => childId !== id) };
  return { ...tree, nodes };
}

/**
 * Moves a node into `newParentId`. `index` is the node's position among the
 * new parent's children after the move; omitted or past the end means last.
 * A folder cannot move into itself or its own subfolders (PRD FR-15).
 */
export function moveNode(tree: Tree, id: NodeId, newParentId: NodeId, index?: number): Tree {
  assertNotRoot(id);
  const node = getNode(tree, id);
  const target = getFolder(tree, newParentId);
  if (id === newParentId || isAncestor(tree, id, newParentId)) {
    throw new TreeError('CYCLE', 'A folder cannot be moved into itself or one of its subfolders');
  }
  const oldParent = parentOf(tree, node);
  const oldParentAfter: FolderNode = {
    ...oldParent,
    childIds: oldParent.childIds.filter((childId) => childId !== id),
  };
  const targetBefore = newParentId === oldParent.id ? oldParentAfter : target;
  const moved: TreeNode = { ...node, parentId: newParentId };
  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [oldParent.id]: oldParentAfter,
      [newParentId]: { ...targetBefore, childIds: insertAt(targetBefore.childIds, id, index) },
      [id]: moved,
    },
  };
}

/** Counts what deleting a folder would remove (PRD FR-12). */
export function countDescendants(tree: Tree, folderId: NodeId): { folders: number; items: number } {
  getFolder(tree, folderId);
  let folders = 0;
  let items = 0;
  for (const id of subtreeIds(tree, folderId).slice(1)) {
    if (getNode(tree, id).type === 'folder') folders += 1;
    else items += 1;
  }
  return { folders, items };
}

/** Every item under a folder, through all subfolders, top to bottom as displayed (PRD FR-30). */
export function collectItems(tree: Tree, folderId: NodeId): ItemNode[] {
  getFolder(tree, folderId);
  return subtreeIds(tree, folderId)
    .map((id) => getNode(tree, id))
    .filter((node): node is ItemNode => node.type === 'item');
}

// --- helpers ---

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new TreeError('INVALID_NAME', 'Name must not be empty');
  return trimmed;
}

function assertNotRoot(id: NodeId): void {
  if (id === ROOT_ID) throw new TreeError('ROOT_IMMUTABLE', 'The root folder cannot be changed');
}

function assertNewId(tree: Tree, id: NodeId): void {
  if (Object.hasOwn(tree.nodes, id)) {
    throw new TreeError('DUPLICATE_ID', `Id "${id}" is already in use`);
  }
}

function parentOf(tree: Tree, node: TreeNode): FolderNode {
  if (node.parentId === null) {
    throw new TreeError('ROOT_IMMUTABLE', 'The root folder has no parent');
  }
  return getFolder(tree, node.parentId);
}

function insertAt<T>(list: readonly T[], value: T, index: number | undefined): T[] {
  const at = index === undefined ? list.length : Math.min(Math.max(index, 0), list.length);
  return [...list.slice(0, at), value, ...list.slice(at)];
}

function withNode(tree: Tree, node: TreeNode): Tree {
  return { ...tree, nodes: { ...tree.nodes, [node.id]: node } };
}

function withNewChild(tree: Tree, parent: FolderNode, child: TreeNode, index: number | undefined): Tree {
  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [parent.id]: { ...parent, childIds: insertAt(parent.childIds, child.id, index) },
      [child.id]: child,
    },
  };
}

/**
 * Ids of a node and everything below it, in display order (a folder before
 * its contents). Iterative, so very deep trees can't overflow the call stack.
 */
function subtreeIds(tree: Tree, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const stack: NodeId[] = [id];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    out.push(currentId);
    const node = getNode(tree, currentId);
    if (node.type === 'folder') stack.push(...[...node.childIds].reverse());
  }
  return out;
}
