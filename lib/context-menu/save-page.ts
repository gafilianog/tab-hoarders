import type { TreeRepository } from '../storage/tree-repository';
import { addItem, isSaveableUrl } from '../tree/tree';
import { ROOT_ID, type NodeId, type Tree } from '../tree/types';

/** Id of the right-click menu entry (PRD FR-27). */
export const SAVE_PAGE_MENU_ID = 'tabHoarders.savePage';

/** The entry only appears on web pages, never on the browser's own pages. */
export const SAVE_PAGE_URL_PATTERNS: string[] = ['http://*/*', 'https://*/*'];

/** The parts of a menu click this feature reads. The browser's click info and tab fit these. */
export interface MenuClick {
  pageUrl?: string;
}

export interface ClickedTab {
  url?: string;
  title?: string;
}

export interface PageToSave {
  url: string;
  title: string;
}

/**
 * The right-clicked page, or null if it can't be saved (PRD FR-22).
 * The title comes from the tab, and only when the tab shows that same page;
 * otherwise it is left empty and the saved item uses the URL as its title.
 */
export function pageFromMenuClick(info: MenuClick, tab: ClickedTab | undefined): PageToSave | null {
  const url = info.pageUrl ?? tab?.url;
  if (!url || !isSaveableUrl(url)) return null;
  return { url, title: tab?.url === url ? (tab.title ?? '') : '' };
}

/**
 * Saves a page at the end of the top level. Owner decision on FR-27: the
 * menu entry never asks for a folder.
 */
export function savePageToTopLevel(
  repository: TreeRepository,
  page: PageToSave,
  item: { id: NodeId; createdAt: number },
): Promise<Tree> {
  return repository.update((tree) => addItem(tree, ROOT_ID, { ...item, ...page }));
}
