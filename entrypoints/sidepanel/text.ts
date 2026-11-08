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
