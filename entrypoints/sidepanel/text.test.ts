import { describe, expect, it } from 'vitest';
import { TreeError } from '../../lib/tree/tree';
import { describeActionError, describeFolderContents, describeOpenAllResult, plural } from './text';

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

describe('describeActionError', () => {
  it('explains tree errors in plain words', () => {
    expect(describeActionError(new TreeError('NOT_FOUND', 'No node with id "x"'))).toContain('another window');
    expect(describeActionError(new TreeError('CYCLE', 'x'))).toContain("can't be moved into itself");
    expect(describeActionError(new TreeError('INVALID_NAME', 'x'))).toBe("A name can't be empty.");
  });

  it('keeps the details of unexpected errors', () => {
    expect(describeActionError(new TreeError('DUPLICATE_ID', 'Id "a" is already in use'))).toContain(
      'Id "a" is already in use',
    );
    expect(describeActionError(new Error('QUOTA_BYTES quota exceeded'))).toBe(
      "The change couldn't be saved. Details: QUOTA_BYTES quota exceeded",
    );
  });
});

describe('describeOpenAllResult', () => {
  it('reports how many tabs opened and how many failed', () => {
    expect(describeOpenAllResult({ opened: 1, failed: 0 })).toBe('Opened 1 tab');
    expect(describeOpenAllResult({ opened: 4, failed: 2 })).toBe("Opened 4 tabs. 2 couldn't be opened.");
  });
});
