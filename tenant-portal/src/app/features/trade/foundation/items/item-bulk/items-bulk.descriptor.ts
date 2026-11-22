import type { BulkJobModuleDescriptor } from '../../../../../shared/bulk-jobs/bulk-job-modules';
import type { BulkJob, BulkJobItem } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { TRADE_ITEMS_BULK_APP, TRADE_ITEMS_BULK_MODULE_NAME } from './item-bulk.model';

export const TRADE_ITEMS_BULK_MODULE: BulkJobModuleDescriptor = {
  app: TRADE_ITEMS_BULK_APP,
  module: TRADE_ITEMS_BULK_MODULE_NAME,
  i18nScopes: ['trade-items-bulk'],
  actions: {
    SET_STATUS: {
      titleKey: 'itemsBulk.action.SET_STATUS',
      icon: 'tablerArrowsExchange',
      tone: 'violet',
      succeededKey: 'itemsBulk.succeeded',
    },
    SET_CATEGORY: {
      titleKey: 'itemsBulk.action.SET_CATEGORY',
      icon: 'tablerTag',
      tone: 'amber',
      succeededKey: 'itemsBulk.succeeded',
    },
    ENABLE_FOR_COMPANY: {
      titleKey: 'itemsBulk.action.ENABLE_FOR_COMPANY',
      icon: 'tablerCheck',
      tone: 'green',
      succeededKey: 'itemsBulk.succeeded',
    },
    SET_CAPABILITIES: {
      titleKey: 'itemsBulk.action.SET_CAPABILITIES',
      icon: 'tablerEdit',
      tone: 'blue',
      succeededKey: 'itemsBulk.succeeded',
    },
  },
  codeKeyPrefixes: ['itemsBulk.codes.'],
  toasts: {
    startedKey: 'itemsBulk.started',
    activeKey: 'itemsBulk.activeJob.title',
    activeDetailKey: 'itemsBulk.activeJob.open',
  },
  itemLink: (item: BulkJobItem, job: BulkJob) => {
    if (!item.entityId || item.current === null) return null;
    return {
      commands: ['/trade/foundation/items'],
      queryParams: {
        item: item.entityId,
        ...(job.scope.companyId ? { scope: 'company' } : {}),
      },
    };
  },
  selectFailedRoute: (job: BulkJob) => ({
    commands: ['/trade/foundation/items'],
    queryParams: {
      bulkJob: job.id,
      bulkApp: TRADE_ITEMS_BULK_APP,
      select: 'failed',
      view: 'table',
      ...(job.scope.companyId ? { scope: 'company' } : {}),
    },
  }),
};
