import { afterEach, beforeEach } from 'vitest';
import { EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { bindCrmInjector } from './app/features/crm/shared/crm-runtime';
import { bindCrmHttp, crmHttp, crmQueries } from './app/features/crm/shared/crm-http';
import { CrmHttpStub } from './app/features/crm/shared/testing/crm-http-testing';
import { resetSeatsFake } from './app/features/workspace/seats/seats.fake';

const defaultStub = new CrmHttpStub();
const defaultQueries = crmQueries();

function resetTestState(): void {
  resetSeatsFake();
  const current = crmHttp();
  if (current instanceof CrmHttpStub) current.reset();
  defaultQueries.clear();
  crmQueries().clear();
  defaultStub.reset();
  bindCrmHttp(defaultStub, defaultQueries);
}

bindCrmHttp(defaultStub, defaultQueries);
bindCrmInjector(() => TestBed.inject(EnvironmentInjector));
beforeEach(resetTestState);
afterEach(resetTestState);
