import { isSaveableUrl } from '../tree/tree';
import type { TabsApi } from './tab-actions';

/** Opening more than this many tabs asks for confirmation first (PRD FR-32, D8). */
export const OPEN_ALL_CONFIRM_THRESHOLD = 20;

export function needsOpenAllConfirmation(count: number): boolean {
  return count > OPEN_ALL_CONFIRM_THRESHOLD;
}

export interface OpenAllOptions {
  /** Tabs opened before each pause. */
  batchSize?: number;
  /** Pause between batches, so the browser can start loading the tabs it has. */
  pauseMs?: number;
  /** Replaced in tests, so they don't wait. */
  sleep?: (ms: number) => Promise<void>;
}

export interface OpenAllResult {
  opened: number;
  failed: number;
}

/**
 * Opens pages as background tabs in this window, in the given order
 * (PRD FR-30, FR-31), a few at a time with a short pause in between (FR-33).
 * A page that fails to open is counted and skipped; the rest still open.
 * Anything but http and https is refused, in case stored data was tampered with.
 */
export async function openAll(
  tabs: Pick<TabsApi, 'create'>,
  urls: readonly string[],
  options: OpenAllOptions = {},
): Promise<OpenAllResult> {
  const { batchSize = 5, pauseMs = 250, sleep = defaultSleep } = options;
  let opened = 0;
  let failed = 0;
  for (const [index, url] of urls.entries()) {
    if (index > 0 && index % batchSize === 0) await sleep(pauseMs);
    if (!isSaveableUrl(url)) {
      failed += 1;
      continue;
    }
    try {
      // Awaiting each one keeps the tabs in tree order.
      await tabs.create({ url, active: false });
      opened += 1;
    } catch {
      failed += 1;
    }
  }
  return { opened, failed };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
