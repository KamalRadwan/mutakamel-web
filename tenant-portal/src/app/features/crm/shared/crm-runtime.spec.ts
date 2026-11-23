import { EnvironmentInjector, inject, InjectionToken, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { bindCrmInjector, bindCrmInjectorForTest, runInCrm } from './crm-runtime';

const value = new InjectionToken<string>('CRM runtime test');

describe('CrmRuntime', () => {
  let restore: () => void;

  beforeEach(() => { restore = bindCrmInjectorForTest(undefined); });
  afterEach(() => restore());

  it('runs fn in the bound injector', () => {
    const injector = Injector.create({ providers: [{ provide: value, useValue: 'bound' }] });
    bindCrmInjector(() => injector);
    expect(runInCrm(() => inject(value))).toBe('bound');
    injector.destroy();
  });

  it('throws when not bound', () => {
    expect(() => runInCrm(() => 'unused')).toThrowError('CRM runtime is not bound');
  });

  it('resolves the injector at call time', () => {
    const get = vi.fn(() => TestBed.inject(EnvironmentInjector));
    bindCrmInjector(get);
    expect(get).not.toHaveBeenCalled();
    TestBed.configureTestingModule({ providers: [{ provide: value, useValue: 'configured later' }] });
    expect(runInCrm(() => inject(value))).toBe('configured later');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('restores the previous binding after a test override', () => {
    const injector = Injector.create({ providers: [{ provide: value, useValue: 'original' }] });
    bindCrmInjector(() => injector);
    const dispose = bindCrmInjectorForTest(undefined);
    expect(() => runInCrm(() => inject(value))).toThrowError('CRM runtime is not bound');
    dispose();
    expect(runInCrm(() => inject(value))).toBe('original');
    injector.destroy();
  });
});
