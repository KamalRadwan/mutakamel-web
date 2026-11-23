import { afterEach, beforeEach } from 'vitest';
import { EnvironmentInjector, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { bindCrmInjector } from './app/features/crm/shared/crm-runtime';
import { bindCrmHttp, crmHttp, crmQueries } from './app/features/crm/shared/crm-http';
import { CrmHttpStub } from './app/features/crm/shared/testing/crm-http-testing';
import { bindTradeHttp, tradeCore, tradeHttp, tradeQueries } from './app/features/trade/shared/trade-http';
import { TradeCoreStub, TradeHttpStub } from './app/features/trade/shared/testing/trade-http-testing';
import { resetSeatsFake } from './app/features/workspace/seats/seats.fake';
import { bindBulkJobsApi, BulkJobsApi } from './app/shared/bulk-jobs/bulk-jobs.api';
import { fakeBulkJobsTransport } from './app/shared/bulk-jobs/bulk-jobs.fake';

const defaultStub = new CrmHttpStub();
const defaultQueries = crmQueries();
const defaultTradeStub = new TradeHttpStub();
const defaultTradeCoreStub = new TradeCoreStub();
const defaultTradeQueries = tradeQueries();
const bulkTestInjector = Injector.create({ providers: [{ provide: BulkJobsApi, useValue: fakeBulkJobsTransport }] });

function resetTestState(): void {
  resetSeatsFake();
  const current = crmHttp();
  if (current instanceof CrmHttpStub) current.reset();
  defaultQueries.clear();
  crmQueries().clear();
  defaultStub.reset();
  bindCrmHttp(defaultStub, defaultQueries);
  const currentTrade = tradeHttp();
  if (currentTrade instanceof TradeHttpStub) currentTrade.reset();
  const currentCore = tradeCore();
  if (currentCore instanceof TradeCoreStub) currentCore.reset();
  defaultTradeQueries.clear();
  tradeQueries().clear();
  defaultTradeStub.reset();
  defaultTradeCoreStub.reset();
  bindTradeHttp(defaultTradeStub, defaultTradeQueries, defaultTradeCoreStub);
  bindBulkJobsApi(() => bulkTestInjector.get(BulkJobsApi));
}

bindCrmHttp(defaultStub, defaultQueries);
bindTradeHttp(defaultTradeStub, defaultTradeQueries, defaultTradeCoreStub);
bindCrmInjector(() => TestBed.inject(EnvironmentInjector));
beforeEach(resetTestState);
afterEach(resetTestState);
