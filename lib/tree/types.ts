/**
 * Stored data format. When this changes, bump SCHEMA_VERSION and add a
 * migration for data saved by older versions (PRD FR-52).
 */
export const SCHEMA_VERSION = 1;

/** Id of the invisible top-level folder. Every other node sits below it. */
export const ROOT_ID = 'root';

export type NodeId = string;

export interface FolderNode {
  type: 'folder';
  id: NodeId;
  /** null only for the root folder. */
  parentId: NodeId | null;
  name: string;
  /** Children in display order. */
  childIds: NodeId[];
  expanded: boolean;
  createdAt: number;
}

export interface ItemNode {
  type: 'item';
  id: NodeId;
  parentId: NodeId;
  url: string;
  title: string;
  createdAt: number;
}

export type TreeNode = FolderNode | ItemNode;

/**
 * The whole tree as a flat map of nodes keyed by id. Folders list their
 * children by id; every node points back to its parent.
 */
export interface Tree {
  schemaVersion: typeof SCHEMA_VERSION;
  nodes: Record<NodeId, TreeNode>;
}
