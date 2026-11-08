// Small inline SVG icons. They use currentColor, so they follow the theme.

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={open ? 'chevron open' : 'chevron'} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg className="icon folder-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M1 3.5C1 2.7 1.7 2 2.5 2h3.6l1.6 1.6h5.8c.8 0 1.5.7 1.5 1.5v7.4c0 .8-.7 1.5-1.5 1.5h-11C1.7 14 1 13.3 1 12.5z"
      />
    </svg>
  );
}

export function NewFolderIcon() {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        d="M1.7 3.5c0-.5.4-.9.9-.9h3.3l1.6 1.6h5.9c.5 0 .9.4.9.9v7.4c0 .5-.4.9-.9.9H2.6c-.5 0-.9-.4-.9-.9z"
      />
      <path d="M8 6.8v4M6 8.8h4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}
