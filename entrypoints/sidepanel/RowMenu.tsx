import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface MenuEntry {
  label: string;
  danger?: boolean;
  run: () => void;
}

export interface Point {
  x: number;
  y: number;
}

const EDGE_PX = 4;

/**
 * A small action menu at `anchor`, kept inside the panel. Closes on a click
 * outside, Escape or Tab. Arrow keys move between entries.
 */
export function RowMenu({
  anchor,
  label,
  entries,
  onClose,
}: {
  anchor: Point;
  label: string;
  entries: MenuEntry[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(anchor);

  // Measure before the first paint, then move the menu so it fits.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const x = Math.max(EDGE_PX, Math.min(anchor.x, window.innerWidth - width - EDGE_PX));
    const fitsBelow = anchor.y + height <= window.innerHeight - EDGE_PX;
    const y = fitsBelow ? anchor.y : Math.max(EDGE_PX, anchor.y - height);
    setPosition({ x, y });
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [anchor]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const current = items.findIndex((item) => item === document.activeElement);
    const focusAt = (index: number) => items[(index + items.length) % items.length]?.focus();
    switch (event.key) {
      case 'Escape':
      case 'Tab':
        event.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusAt(current + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(items.length - 1);
        break;
    }
  };

  return (
    <>
      <div
        className="menu-backdrop"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        className="menu"
        style={{ left: position.x, top: position.y }}
        onKeyDown={onKeyDown}
      >
        {entries.map((entry) => (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            className={entry.danger ? 'menu-item danger' : 'menu-item'}
            onClick={() => {
              onClose();
              entry.run();
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </>
  );
}
