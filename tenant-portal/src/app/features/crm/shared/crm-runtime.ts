import { Injector, runInInjectionContext } from '@angular/core';

let getInjector: (() => Injector) | undefined;

export function bindCrmInjector(get: () => Injector): void {
  getInjector = get;
}

export function runInCrm<T>(fn: () => T): T {
  if (!getInjector) throw new Error('CRM runtime is not bound');
  return runInInjectionContext(getInjector(), fn);
}

export function bindCrmInjectorForTest(get: (() => Injector) | undefined): () => void {
  const previous = getInjector;
  getInjector = get;
  return () => { getInjector = previous; };
}
