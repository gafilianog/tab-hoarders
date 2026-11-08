import { describe, expect, it } from 'vitest';
import { describeFolderContents, plural } from './text';

describe('plural', () => {
  it('adds an s except for one', () => {
    expect(plural(0, 'page')).toBe('0 pages');
    expect(plural(1, 'page')).toBe('1 page');
    expect(plural(2, 'page')).toBe('2 pages');
  });
});

describe('describeFolderContents', () => {
  it('names folders and saved pages that will be deleted', () => {
    expect(describeFolderContents({ folders: 2, items: 1 })).toBe(
      "Everything inside it is deleted too: 2 folders and 1 saved page. This can't be undone.",
    );
  });

  it('leaves out a count of zero', () => {
    expect(describeFolderContents({ folders: 0, items: 3 })).toContain(': 3 saved pages.');
    expect(describeFolderContents({ folders: 1, items: 0 })).toContain(': 1 folder.');
  });
});
