import type { NodeId } from '../tree/types';
import type { KeyValueArea } from './tree-repository';

export const SAVE_TARGET_KEY = 'tabHoarders.saveTargetFolderId';

/**
 * The folder "Save tab" saves into: the one the user last picked or saved
 * into (PRD FR-20). Null when nothing has been picked yet.
 */
export async function loadSaveTarget(area: KeyValueArea): Promise<NodeId | null> {
  const stored = await area.get(SAVE_TARGET_KEY);
  const value = stored[SAVE_TARGET_KEY];
  return typeof value === 'string' ? value : null;
}

export async function storeSaveTarget(area: KeyValueArea, folderId: NodeId): Promise<void> {
  await area.set({ [SAVE_TARGET_KEY]: folderId });
}
