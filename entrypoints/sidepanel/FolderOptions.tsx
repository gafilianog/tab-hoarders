import type { FolderEntry } from '@/lib/tree/tree';
import { ROOT_ID } from '@/lib/tree/types';

const INDENT = '\u00A0\u00A0\u00A0';

/** <option>s for picking a folder: "Top level", then folders indented by depth. */
export function FolderOptions({ entries }: { entries: FolderEntry[] }) {
  return (
    <>
      <option value={ROOT_ID}>Top level</option>
      {entries.map(({ folder, depth }) => (
        <option key={folder.id} value={folder.id}>
          {INDENT.repeat(depth + 1) + folder.name}
        </option>
      ))}
    </>
  );
}
