import { useEffect, useState } from 'react';

// M0 check: count how many times the panel has been opened, stored in
// chrome.storage.local. If the count keeps going up after a full browser
// restart, storage persistence works. The folder tree replaces this in M2.
const OPEN_COUNT_KEY = 'm0.panelOpenCount';

async function recordPanelOpen(): Promise<number> {
  const stored = await browser.storage.local.get(OPEN_COUNT_KEY);
  const next = Number(stored[OPEN_COUNT_KEY] ?? 0) + 1;
  await browser.storage.local.set({ [OPEN_COUNT_KEY]: next });
  return next;
}

// Runs once per panel load, outside React. React's StrictMode runs effects
// twice in dev mode, which would otherwise count one open as two.
const panelOpenCount = recordPanelOpen();

export default function App() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    panelOpenCount.then(setCount, (e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  let countText = '…';
  if (error) countText = `Storage error: ${error}`;
  else if (count !== null) countText = `${count} time(s)`;

  return (
    <main>
      <h1>Tab Hoarders</h1>
      <p>M0 check panel. The folder tree replaces this in M2.</p>
      <dl>
        <dt>Panel opened</dt>
        <dd>{countText}</dd>
        <dt>Panel width</dt>
        <dd>{width} px</dd>
      </dl>
    </main>
  );
}
