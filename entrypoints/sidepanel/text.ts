// Relative import: unit tests run without WXT's "@/" path alias.
import { TreeError } from '../../lib/tree/tree';

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Message for the delete-folder confirmation (PRD FR-12). */
export function describeFolderContents(counts: { folders: number; items: number }): string {
  const parts: string[] = [];
  if (counts.folders > 0) parts.push(plural(counts.folders, 'folder'));
  if (counts.items > 0) parts.push(plural(counts.items, 'saved page'));
  return `Everything inside it is deleted too: ${parts.join(' and ')}. This can't be undone.`;
}

/** What to tell the user when a change fails. Nothing was saved in any of these cases. */
export function describeActionError(error: unknown): string {
  if (error instanceof TreeError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return 'That folder or page no longer exists. It may have been deleted in another window.';
      case 'CYCLE':
        return "A folder can't be moved into itself or one of its subfolders.";
      case 'INVALID_NAME':
        return "A name can't be empty.";
      case 'INVALID_URL':
        return 'Only web pages (http and https) can be saved.';
      default:
        return `Something went wrong, so nothing was changed. Details: ${error.message}`;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return `The change couldn't be saved. Details: ${message}`;
}

/** Result message after "Open all" (PRD FR-30). */
export function describeOpenAllResult(result: { opened: number; failed: number }): string {
  const opened = `Opened ${plural(result.opened, 'tab')}`;
  return result.failed === 0 ? opened : `${opened}. ${result.failed} couldn't be opened.`;
}
