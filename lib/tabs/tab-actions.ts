import { isSaveableUrl } from '../tree/tree';

/** The parts of the browser's tabs API these helpers use. Tests pass a fake. */
export interface TabsApi {
  query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<TabInfo[]>;
  update(tabId: number, updateProperties: { active: boolean }): Promise<unknown>;
  create(createProperties: { url: string; active: boolean }): Promise<unknown>;
}

export interface TabInfo {
  id?: number;
  url?: string;
  title?: string;
}

export type CurrentPage =
  | { ok: true; url: string; title: string }
  | { ok: false; reason: 'no-active-tab' | 'unsupported-url' };

/** The page in this window's active tab, if it can be saved (PRD FR-20, FR-22). */
export async function getCurrentPage(tabs: TabsApi): Promise<CurrentPage> {
  const [tab] = await tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return { ok: false, reason: 'no-active-tab' };
  if (!isSaveableUrl(tab.url)) return { ok: false, reason: 'unsupported-url' };
  return { ok: true, url: tab.url, title: tab.title ?? '' };
}

/**
 * Opens a saved page (PRD FR-23). If a tab in this window already shows
 * exactly this URL, switches to it. Otherwise opens it in a new tab.
 * Refuses anything but http and https, in case stored data was tampered with.
 */
export async function openOrFocus(tabs: TabsApi, url: string): Promise<'focused' | 'opened'> {
  if (!isSaveableUrl(url)) throw new Error(`Refusing to open a non-web URL: ${url}`);
  const open = await tabs.query({ currentWindow: true });
  const existing = open.find((tab) => tab.url === url && tab.id !== undefined);
  if (existing?.id !== undefined) {
    await tabs.update(existing.id, { active: true });
    return 'focused';
  }
  await tabs.create({ url, active: true });
  return 'opened';
}
