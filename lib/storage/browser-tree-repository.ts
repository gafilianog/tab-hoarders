import { browser } from 'wxt/browser';
import { TreeRepository } from './tree-repository';

/** The repository backed by the extension's local storage (PRD D2). */
export function createBrowserTreeRepository(): TreeRepository {
  return new TreeRepository(browser.storage.local);
}
