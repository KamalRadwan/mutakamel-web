import { InjectionToken } from '@angular/core';
import { SipEngine, SipEngineFactory } from './sip-engine';
import { FakeSipEngine } from './sip-engine.fake';
import { JsSipEngine } from './sip-engine.jssip';

export const PHONE_ENGINE_STORAGE_KEY = 'mutakamel.phone.engine';

/** Dev builds use the fake engine unless a developer opts in to the real one (owner 2026-11-21: stay on fake data until Phase 5). */
function isRealEngineSelected(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(PHONE_ENGINE_STORAGE_KEY) === 'jssip';
  } catch {
    return false;
  }
}

/** True when the fake SIP engine is the active engine (every tab shares the same choice through localStorage). */
export function isFakeSipEngineSelected(): boolean {
  return !isRealEngineSelected();
}

/** Creates the active SIP engine in every build mode: `FakeSipEngine` unless `mutakamel.phone.engine=jssip`. Phase 5: make the real engine the default. */
export function createSipEngine(): SipEngine {
  return isRealEngineSelected() ? new JsSipEngine() : new FakeSipEngine();
}

export const SIP_ENGINE_FACTORY = new InjectionToken<SipEngineFactory>('SIP_ENGINE_FACTORY', {
  providedIn: 'root',
  factory: () => () => createSipEngine(),
});
