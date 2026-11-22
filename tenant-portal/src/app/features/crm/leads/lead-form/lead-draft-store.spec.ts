import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LeadDraftStore } from './lead-draft-store';
import { emptyDraft } from './lead-draft';

describe('LeadDraftStore', () => {
  const createStore = () => TestBed.runInInjectionContext(() => new LeadDraftStore());

  it('returns the entry that was put, once', () => {
    const store = createStore();
    const entry = { draft: emptyDraft(), leadId: null, baseUpdatedAt: null };

    const key = store.put(entry);

    expect(store.take(key)).toEqual({ ...entry, nav: null });
    expect(store.take(key)).toBeNull();
  });

  it('returns null for an unknown key', () => {
    expect(createStore().take('nope')).toBeNull();
  });

  it('hands out a distinct key for every entry', () => {
    const store = createStore();
    const entry = { draft: emptyDraft(), leadId: 'l1', baseUpdatedAt: 'v1' };

    expect(store.put(entry)).not.toBe(store.put(entry));
  });
});
