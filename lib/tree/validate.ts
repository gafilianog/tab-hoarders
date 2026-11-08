import { ROOT_ID, SCHEMA_VERSION, type Tree, type TreeNode } from './types';

export type ParseResult = { ok: true; tree: Tree } | { ok: false; reason: string };

/**
 * Checks data read from storage before the app trusts it (PRD FR-53).
 * Never throws. On failure it returns the first problem found, so the UI can
 * show it while the stored data is left untouched.
 */
export function parseTree(raw: unknown): ParseResult {
  if (!isRecord(raw)) return fail('stored tree is not an object');
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    return fail(`unsupported schemaVersion ${String(raw.schemaVersion)}`);
  }
  if (!isRecord(raw.nodes)) return fail('nodes is missing or not an object');

  const entries = Object.entries(raw.nodes);
  for (const [key, value] of entries) {
    const problem = checkNode(key, value);
    if (problem) return fail(problem);
  }
  const nodes = raw.nodes as Record<string, TreeNode>;

  const root = Object.hasOwn(nodes, ROOT_ID) ? nodes[ROOT_ID] : undefined;
  if (!root || root.type !== 'folder') return fail('root folder is missing');

  // Every non-root node must be listed exactly once, by the folder that its
  // parentId names.
  const listed = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (node.type !== 'folder') continue;
    for (const childId of node.childIds) {
      const child = Object.hasOwn(nodes, childId) ? nodes[childId] : undefined;
      if (!child) return fail(`folder "${node.id}" lists missing child "${childId}"`);
      if (listed.has(childId)) return fail(`node "${childId}" is listed more than once`);
      if (child.parentId !== node.id) {
        return fail(`node "${childId}" is listed by "${node.id}" but its parentId is "${String(child.parentId)}"`);
      }
      listed.add(childId);
    }
  }
  if (listed.size !== entries.length - 1) return fail('some nodes are not listed by any folder');

  // With the links consistent, a node not reachable from the root can only
  // be part of a detached cycle.
  const reached = new Set<string>([ROOT_ID]);
  const stack: string[] = [ROOT_ID];
  while (stack.length > 0) {
    const node = nodes[stack.pop()!];
    if (node?.type !== 'folder') continue;
    for (const childId of node.childIds) {
      if (!reached.has(childId)) {
        reached.add(childId);
        stack.push(childId);
      }
    }
  }
  if (reached.size !== entries.length) return fail('tree contains a cycle');

  return { ok: true, tree: raw as unknown as Tree };
}

function checkNode(key: string, value: unknown): string | null {
  if (!isRecord(value)) return `node "${key}" is not an object`;
  if (value.id !== key) return `node "${key}" has a mismatched id`;
  if (!isTimestamp(value.createdAt)) return `node "${key}" has an invalid createdAt`;

  if (value.type === 'folder') {
    if (typeof value.name !== 'string') return `folder "${key}" has an invalid name`;
    if (typeof value.expanded !== 'boolean') return `folder "${key}" has an invalid expanded flag`;
    if (!Array.isArray(value.childIds) || !value.childIds.every((id) => typeof id === 'string')) {
      return `folder "${key}" has invalid childIds`;
    }
    const parentOk = key === ROOT_ID ? value.parentId === null : typeof value.parentId === 'string';
    return parentOk ? null : `folder "${key}" has an invalid parentId`;
  }

  if (value.type === 'item') {
    if (typeof value.url !== 'string') return `item "${key}" has an invalid url`;
    if (typeof value.title !== 'string') return `item "${key}" has an invalid title`;
    if (typeof value.parentId !== 'string') return `item "${key}" has an invalid parentId`;
    return null;
  }

  return `node "${key}" has an unknown type`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function fail(reason: string): ParseResult {
  return { ok: false, reason };
}
