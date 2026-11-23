import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BULK_JOB_MODULES, provideBulkJobModules, type BulkJobModuleDescriptor } from './bulk-job-modules';

describe('provideBulkJobModules', () => {
  it('composes module descriptors as one ordered multi-provider collection', () => {
    const core: BulkJobModuleDescriptor = {
      app: 'core', module: 'core.users', i18nScopes: ['staff-users'], actions: {}, codeKeyPrefixes: [],
    };
    const trade: BulkJobModuleDescriptor = {
      app: 'trading', module: 'trading.items', i18nScopes: ['trade-items'], actions: {}, codeKeyPrefixes: [],
    };
    TestBed.configureTestingModule({ providers: [
      provideBulkJobModules([core]),
      provideBulkJobModules([trade]),
    ] });
    const modules = TestBed.inject(BULK_JOB_MODULES);
    expect(modules).toEqual([core, trade]);
    expect(modules[0]).toBe(core);
    expect(modules[1]).toBe(trade);
  });
});
