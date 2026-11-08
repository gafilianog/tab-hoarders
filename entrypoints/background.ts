import {
  SAVE_PAGE_MENU_ID,
  SAVE_PAGE_URL_PATTERNS,
  pageFromMenuClick,
  savePageToTopLevel,
} from '@/lib/context-menu/save-page';
import { createBrowserTreeRepository } from '@/lib/storage/browser-tree-repository';

/** Short feedback on the toolbar icon after a right-click save. */
const BADGE = {
  saved: { text: '✓', color: '#188038' },
  failed: { text: '!', color: '#b3261e' },
} as const;
const BADGE_MS = 2000;

export default defineBackground(() => {
  // Make a click on the toolbar icon open the side panel. Chrome remembers
  // this setting, but setting it on every service worker start is cheap and
  // keeps it correct after an update.
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error('setPanelBehavior failed', error));

  // Right-click "Save page to Tab Hoarders" (PRD FR-27). The browser keeps
  // menu entries across service worker restarts, so they are created only
  // when the extension is installed or updated.
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus
      .removeAll()
      .then(() => {
        browser.contextMenus.create(
          {
            id: SAVE_PAGE_MENU_ID,
            title: 'Save page to Tab Hoarders',
            contexts: ['page'],
            documentUrlPatterns: SAVE_PAGE_URL_PATTERNS,
          },
          () => {
            const error = browser.runtime.lastError;
            if (error) console.error('Creating the menu entry failed', error.message);
          },
        );
      })
      .catch((error: unknown) => console.error('Resetting the menu failed', error));
  });

  // Uses the same write lock as the side panels, so a right-click save and
  // a change in a panel can't overwrite each other.
  const repository = createBrowserTreeRepository();

  // Saves to the top level only (owner decision). Open panels show the new
  // row through their storage listener.
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== SAVE_PAGE_MENU_ID) return;
    const tabId = tab?.id;
    const page = pageFromMenuClick(info, tab);
    if (!page) {
      void flashBadge(tabId, 'failed');
      return;
    }
    void savePageToTopLevel(repository, page, { id: crypto.randomUUID(), createdAt: Date.now() }).then(
      () => flashBadge(tabId, 'saved'),
      (error: unknown) => {
        console.error('Saving the page failed', error);
        return flashBadge(tabId, 'failed');
      },
    );
  });
});

/** Shows a mark on the toolbar icon in one tab for two seconds. */
async function flashBadge(tabId: number | undefined, kind: keyof typeof BADGE): Promise<void> {
  if (tabId === undefined) return;
  const { text, color } = BADGE[kind];
  try {
    await browser.action.setBadgeBackgroundColor({ tabId, color });
    await browser.action.setBadgeText({ tabId, text });
    setTimeout(() => {
      browser.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
    }, BADGE_MS);
  } catch {
    // The tab was closed in the meantime; there is nothing to show.
  }
}
