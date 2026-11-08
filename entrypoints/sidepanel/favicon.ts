import type { PublicPath } from 'wxt/browser';

// Chrome serves this path itself; it is not a file in the extension, so WXT's
// list of known paths doesn't include it.
const FAVICON_PATH = '/_favicon/' as PublicPath;

/**
 * URL of a page's icon from the browser's favicon cache (needs the "favicon"
 * permission). Pages the browser has never shown get a generic globe icon.
 */
export function faviconUrl(pageUrl: string, size = 32): string {
  const url = new URL(browser.runtime.getURL(FAVICON_PATH));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}
