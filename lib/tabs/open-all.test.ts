import { describe, expect, it } from 'vitest';
import { OPEN_ALL_CONFIRM_THRESHOLD, needsOpenAllConfirmation, openAll } from './open-all';

/** Records every created tab and every pause, in order. */
function fakeTabs(failUrls: string[] = []) {
  const log: string[] = [];
  const tabs = {
    async create(props: { url: string; active: boolean }) {
      if (failUrls.includes(props.url)) throw new Error('No tab for you');
      log.push(`create ${props.url} active=${props.active}`);
    },
  };
  const sleep = async (ms: number) => {
    log.push(`pause ${ms}`);
  };
  return { tabs, sleep, log };
}

const urls = (count: number) => Array.from({ length: count }, (_, i) => `https://example.com/${i + 1}`);

describe('openAll', () => {
  it('opens every page in order, in the background (FR-30, FR-31)', async () => {
    const { tabs, sleep, log } = fakeTabs();
    expect(await openAll(tabs, urls(3), { sleep })).toEqual({ opened: 3, failed: 0 });
    expect(log).toEqual([
      'create https://example.com/1 active=false',
      'create https://example.com/2 active=false',
      'create https://example.com/3 active=false',
    ]);
  });

  it('pauses between batches (FR-33)', async () => {
    const { tabs, sleep, log } = fakeTabs();
    await openAll(tabs, urls(12), { sleep, batchSize: 5, pauseMs: 100 });
    expect(log.filter((line) => line.startsWith('pause'))).toEqual(['pause 100', 'pause 100']);
    expect(log.indexOf('pause 100')).toBe(5);
  });

  it('does not pause when everything fits in one batch', async () => {
    const { tabs, sleep, log } = fakeTabs();
    await openAll(tabs, urls(5), { sleep, batchSize: 5 });
    expect(log.some((line) => line.startsWith('pause'))).toBe(false);
  });

  it('refuses non-web URLs without opening them', async () => {
    const { tabs, sleep, log } = fakeTabs();
    const result = await openAll(tabs, ['javascript:alert(1)', 'https://example.com/ok', 'file:///etc/hosts'], { sleep });
    expect(result).toEqual({ opened: 1, failed: 2 });
    expect(log).toEqual(['create https://example.com/ok active=false']);
  });

  it('keeps going after a tab fails to open', async () => {
    const { tabs, sleep, log } = fakeTabs(['https://example.com/2']);
    expect(await openAll(tabs, urls(3), { sleep })).toEqual({ opened: 2, failed: 1 });
    expect(log).toEqual(['create https://example.com/1 active=false', 'create https://example.com/3 active=false']);
  });

  it('does nothing for an empty list', async () => {
    const { tabs, sleep, log } = fakeTabs();
    expect(await openAll(tabs, [], { sleep })).toEqual({ opened: 0, failed: 0 });
    expect(log).toEqual([]);
  });
});

describe('needsOpenAllConfirmation (FR-32, D8)', () => {
  it('asks only for more than 20 tabs', () => {
    expect(OPEN_ALL_CONFIRM_THRESHOLD).toBe(20);
    expect(needsOpenAllConfirmation(20)).toBe(false);
    expect(needsOpenAllConfirmation(21)).toBe(true);
  });
});
