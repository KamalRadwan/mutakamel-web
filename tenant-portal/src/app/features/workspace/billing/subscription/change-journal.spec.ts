import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CHANGE_JOURNAL_KEY,
  ChangeJournalEntry,
  clearChangeJournal,
  hasChangeJournal,
  readChangeJournal,
  writeChangeJournal,
} from './change-journal';

function entry(): ChangeJournalEntry {
  return {
    operationId: 'op-1',
    operationRevision: 'r1',
    previewId: 'pv-1',
    body: {
      expectedSubscriptionRevision: 's1',
      changes: [{ operation: 'ADD' }],
    } as unknown as ChangeJournalEntry['body'],
  };
}

describe('change journal', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(readChangeJournal()).toBeNull();
    expect(hasChangeJournal()).toBe(false);
  });

  it('reads back what was written', () => {
    writeChangeJournal(entry());
    expect(readChangeJournal()).toEqual(entry());
    expect(hasChangeJournal()).toBe(true);
  });

  it('clears the stored entry', () => {
    writeChangeJournal(entry());
    clearChangeJournal();
    expect(readChangeJournal()).toBeNull();
  });

  it('ignores malformed JSON', () => {
    sessionStorage.setItem(CHANGE_JOURNAL_KEY, '{not json');
    expect(readChangeJournal()).toBeNull();
  });

  it('rejects an entry with a blank operation id', () => {
    sessionStorage.setItem(CHANGE_JOURNAL_KEY, JSON.stringify({ ...entry(), operationId: '  ' }));
    expect(readChangeJournal()).toBeNull();
  });

  it('rejects an entry with an empty change list', () => {
    const bad = { ...entry(), body: { expectedSubscriptionRevision: 's1', changes: [] } };
    sessionStorage.setItem(CHANGE_JOURNAL_KEY, JSON.stringify(bad));
    expect(readChangeJournal()).toBeNull();
  });

  it('rejects an entry with a non-string preview id', () => {
    sessionStorage.setItem(CHANGE_JOURNAL_KEY, JSON.stringify({ ...entry(), previewId: 5 }));
    expect(readChangeJournal()).toBeNull();
  });

  it('accepts an entry without a preview id', () => {
    const { previewId: _omit, ...rest } = entry();
    sessionStorage.setItem(CHANGE_JOURNAL_KEY, JSON.stringify(rest));
    expect(readChangeJournal()?.operationId).toBe('op-1');
  });
});
