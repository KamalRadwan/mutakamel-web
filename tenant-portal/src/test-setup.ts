import { afterEach, beforeEach } from 'vitest';
import { bindCrmHttp, crmHttp, crmQueries } from './app/features/crm/shared/crm-http';
import { CrmHttpStub } from './app/features/crm/shared/testing/crm-http-testing';

const defaultStub = new CrmHttpStub();
const defaultQueries = crmQueries();

function resetCrmBinding(): void {
  const current = crmHttp();
  if (current instanceof CrmHttpStub) current.reset();
  defaultQueries.clear();
  crmQueries().clear();
  defaultStub.reset();
  bindCrmHttp(defaultStub, defaultQueries);
}

bindCrmHttp(defaultStub, defaultQueries);
beforeEach(resetCrmBinding);
afterEach(resetCrmBinding);
