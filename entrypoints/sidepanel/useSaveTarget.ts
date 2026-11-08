import { useCallback, useEffect, useState } from 'react';
import { loadSaveTarget, storeSaveTarget } from '@/lib/storage/settings';
import { ROOT_ID, type NodeId } from '@/lib/tree/types';

/** The folder "Save tab" saves into, kept in storage across panel opens (PRD FR-20). */
export function useSaveTarget() {
  const [target, setTarget] = useState<NodeId>(ROOT_ID);

  useEffect(() => {
    loadSaveTarget(browser.storage.local).then(
      (stored) => {
        if (stored) setTarget(stored);
      },
      (error: unknown) => console.error('Loading the save target failed', error),
    );
  }, []);

  const choose = useCallback((folderId: NodeId) => {
    setTarget(folderId);
    storeSaveTarget(browser.storage.local, folderId).catch((error: unknown) =>
      console.error('Storing the save target failed', error),
    );
  }, []);

  return [target, choose] as const;
}
