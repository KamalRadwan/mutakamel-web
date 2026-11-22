import type { EnvironmentProviders } from '@angular/core';
import {
  type BulkJobModuleDescriptor,
  provideBulkJobModules,
} from '../../../shared/bulk-jobs/bulk-job-modules';
import { registerFakeBulkModuleLoader } from '../../../shared/bulk-jobs/bulk-jobs.fake';
import type { BulkJob, BulkJobItem } from '../../../shared/bulk-jobs/bulk-jobs.model';

registerFakeBulkModuleLoader('trading', 'trading.catalog-import', () => import('./imports.fake'));
registerFakeBulkModuleLoader(
  'trading',
  'trading.control-tower-exceptions',
  () => import('./tower.fake'),
);

export const TRADE_CATALOG_IMPORT_BULK_MODULE: BulkJobModuleDescriptor = {
  app: 'trading',
  module: 'trading.catalog-import',
  i18nScopes: ['trade-automation', 'trade-auto-imports'],
  actions: {
    EXECUTE: {
      titleKey: 'automation.bulk.importExecute.title',
      icon: 'tablerUpload',
      tone: 'blue',
      succeededKey: 'automation.bulk.importExecute.succeeded',
    },
  },
  codeKeyPrefixes: ['automation.errors.', 'automation.workerErrors.', 'imports.rowErrors.'],
  itemLink: (_item: BulkJobItem, job: BulkJob) => {
    const runId = typeof job.paramsSummary['runId'] === 'string' ? job.paramsSummary['runId'] : null;
    return runId ? { commands: ['/trade/automation/import-runs', runId] } : null;
  },
};

export const TRADE_CONTROL_TOWER_BULK_MODULE: BulkJobModuleDescriptor = {
  app: 'trading',
  module: 'trading.control-tower-exceptions',
  i18nScopes: ['trade-automation', 'trade-auto-tower'],
  actions: {
    RESOLVE: {
      titleKey: 'automation.bulk.towerResolve.title',
      icon: 'tablerCheck',
      tone: 'green',
      succeededKey: 'automation.bulk.towerResolve.succeeded',
    },
  },
  codeKeyPrefixes: ['automation.errors.', 'automation.bulk.codes.'],
  itemLink: (item: BulkJobItem) =>
    item.entityId
      ? { commands: ['/trade/automation/control-tower'], queryParams: { id: item.entityId } }
      : null,
};

export const AUTOMATION_BULK_MODULES: BulkJobModuleDescriptor[] = [
  TRADE_CATALOG_IMPORT_BULK_MODULE,
  TRADE_CONTROL_TOWER_BULK_MODULE,
];

export function provideAutomationBulkModules(): EnvironmentProviders {
  return provideBulkJobModules(AUTOMATION_BULK_MODULES);
}
