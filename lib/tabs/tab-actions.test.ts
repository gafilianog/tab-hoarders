import { describe, expect, it } from 'vitest';
import { getCurrentPage, openOrFocus, type TabInfo, type TabsApi } from './tab-actions';

/** Fake tabs API over a list of this window's tabs; the first is the active one. */
function fakeTabs(windowTabs: TabInfo[]) {
  const calls: string[] = [];
  const api: TabsApi = {
    async query(info) {
      calls.push(`query ${JSON.stringify(info)}`);
      return info.active ? windowTabs.slice(0, 1) : windowTabs;
    },
    async update(tabId, props) {
      calls.push(`update ${tabId} ${JSON.stringify(props)}`);
    },
    async create(props) {
      calls.push(`create ${JSON.stringify(props)}`);
    },
  };
  return { api, calls };
}

describe('getCurrentPage', () => {
  it('returns the active tab of this window', async () => {
    const { api, calls } = fakeTabs([{ id: 1, url: 'https://example.com/a', title: 'A' }]);
    expect(await getCurrentPage(api)).toEqual({ ok: true, url: 'https://example.com/a', title: 'A' });
    expect(calls).toEqual(['query {"active":true,"currentWindow":true}']);
  });

  it('uses an empty title when the tab has none', async () => {
    const { api } = fakeTabs([{ id: 1, url: 'https://example.com/' }]);
    expect(await getCurrentPage(api)).toEqual({ ok: true, url: 'https://example.com/', title: '' });
  });

  it('refuses pages that are not http or https (FR-22)', async () => {
    const { api } = fakeTabs([{ id: 1, url: 'chrome://newtab/', title: 'New Tab' }]);
    expect(await getCurrentPage(api)).toEqual({ ok: false, reason: 'unsupported-url' });
  });

  it('reports a missing tab or URL', async () => {
    expect(await getCurrentPage(fakeTabs([]).api)).toEqual({ ok: false, reason: 'no-active-tab' });
    expect(await getCurrentPage(fakeTabs([{ id: 1 }]).api)).toEqual({ ok: false, reason: 'no-active-tab' });
  });
});

describe('openOrFocus', () => {
  it('switches to a tab that already shows the URL (FR-23)', async () => {
    const { api, calls } = fakeTabs([
      { id: 1, url: 'https://example.com/other' },
      { id: 2, url: 'https://example.com/a' },
    ]);
    expect(await openOrFocus(api, 'https://example.com/a')).toBe('focused');
    expect(calls).toEqual(['query {"currentWindow":true}', 'update 2 {"active":true}']);
  });

  it('opens a new tab when no tab matches exactly', async () => {
    const { api, calls } = fakeTabs([{ id: 1, url: 'https://example.com/a#section' }]);
    expect(await openOrFocus(api, 'https://example.com/a')).toBe('opened');
    expect(calls.at(-1)).toBe('create {"url":"https://example.com/a","active":true}');
  });

  it('refuses non-web URLs without touching any tab', async () => {
    const { api, calls } = fakeTabs([]);
    await expect(openOrFocus(api, 'javascript:alert(1)')).rejects.toThrow('non-web URL');
    expect(calls).toEqual([]);
  });
});
