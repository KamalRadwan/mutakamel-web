import { InjectionToken } from '@angular/core';
import { SipEngine, SipEngineFactory } from './sip-engine';
import { JsSipEngine } from './sip-engine.jssip';

export const PHONE_ENGINE_STORAGE_KEY = 'mutakamel.phone.engine';

/** Always use real SIP. Specs may explicitly inject SIP_ENGINE_FACTORY for simulation. */
export function createSipEngine(): SipEngine {
  return new JsSipEngine();
}

export const SIP_ENGINE_FACTORY = new InjectionToken<SipEngineFactory>('SIP_ENGINE_FACTORY', {
  providedIn: 'root',
  factory: () => () => createSipEngine(),
});
