import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsSipEngine } from './sip-engine.jssip';
import { PHONE_ENGINE_STORAGE_KEY, SIP_ENGINE_FACTORY, createSipEngine } from './sip-engine.provider';

describe('production SIP selection', () => {
  afterEach(() => { localStorage.removeItem(PHONE_ENGINE_STORAGE_KEY); vi.restoreAllMocks(); });

  it.each([null, 'fake', 'jssip', 'unknown'])('uses JsSIP with stored selection %s', (selection) => {
    if (selection === null) localStorage.removeItem(PHONE_ENGINE_STORAGE_KEY);
    else localStorage.setItem(PHONE_ENGINE_STORAGE_KEY, selection);
    expect(createSipEngine()).toBeInstanceOf(JsSipEngine);
  });

  it('uses real SIP in development too, without consulting storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    expect(createSipEngine()).toBeInstanceOf(JsSipEngine);
    expect(TestBed.inject(SIP_ENGINE_FACTORY)()).toBeInstanceOf(JsSipEngine);
    expect((window as unknown as Record<string, unknown>)['__phoneFake']).toBeUndefined();
  });
});
