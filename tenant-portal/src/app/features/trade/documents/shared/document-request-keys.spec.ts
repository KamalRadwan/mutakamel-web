import { describe, expect, it } from 'vitest';
import { DocumentRequestKeys } from './document-request-keys';

function counterKeys(): DocumentRequestKeys {
  let n = 0;
  return new DocumentRequestKeys(() => `key-${++n}`);
}

describe('DocumentRequestKeys', () => {
  it('reuses the key when the same request is retried', () => {
    const keys = counterKeys();
    const first = keys.for('send', { id: 'qt-1', version: 2 });
    expect(keys.for('send', { id: 'qt-1', version: 2 })).toBe(first);
  });

  it('starts a new key when the version or body changes', () => {
    const keys = counterKeys();
    const first = keys.for('updateSalesOrder', ['so-1', 2, { draftReference: 'A' }]);
    const newVersion = keys.for('updateSalesOrder', ['so-1', 3, { draftReference: 'A' }]);
    const newBody = keys.for('updateSalesOrder', ['so-1', 3, { draftReference: 'B' }]);
    expect(new Set([first, newVersion, newBody]).size).toBe(3);
  });

  it('keeps a separate key per slot', () => {
    const keys = counterKeys();
    const update = keys.for('updateQuotation', ['qt-1', 1]);
    const revision = keys.for('createQuotationRevision', ['qt-1', 1]);
    expect(revision).not.toBe(update);
    expect(keys.for('updateQuotation', ['qt-1', 1])).toBe(update);
  });

  it('forgets every key after reset (the next user action)', () => {
    const keys = counterKeys();
    const first = keys.for('send', { id: 'qt-1', version: 2 });
    keys.reset();
    expect(keys.for('send', { id: 'qt-1', version: 2 })).not.toBe(first);
  });

  it('issues UUID v7 keys by default', () => {
    expect(new DocumentRequestKeys().for('send', {})).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
