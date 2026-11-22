import { BulkJobModuleDescriptor } from '../../../../shared/bulk-jobs/bulk-job-modules';
import { BulkJob, BulkJobItem } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { CUSTOMERS_BULK_APP, CUSTOMERS_BULK_MODULE_ID } from './customer-bulk.model';

function formatSummaryDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const lang = typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
  return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export const CRM_CUSTOMERS_BULK_MODULE: BulkJobModuleDescriptor = {
  app: CUSTOMERS_BULK_APP,
  module: CUSTOMERS_BULK_MODULE_ID,
  i18nScopes: ['customer-bulk'],
  actions: {
    ASSIGN: {
      titleKey: 'customerBulk.job.ASSIGN',
      icon: 'tablerUserShare',
      tone: 'blue',
      succeededKey: 'customerBulk.job.updated',
    },
    SET_STATUS: {
      titleKey: 'customerBulk.job.SET_STATUS',
      titleParams: (params): Record<string, string> => {
        const status = params['status'];
        return typeof status === 'string' && status ? { statusLabel: `customerBulk.status.${status}` } : {};
      },
      icon: 'tablerArrowsExchange',
      tone: 'green',
      succeededKey: 'customerBulk.job.updated',
    },
    CREATE_ACTIVITY: {
      titleKey: 'customerBulk.job.CREATE_ACTIVITY',
      icon: 'tablerCalendarPlus',
      tone: 'teal',
      succeededKey: 'customerBulk.job.created',
    },
    DELETE: {
      titleKey: 'customerBulk.job.DELETE',
      icon: 'tablerTrash',
      tone: 'red',
      succeededKey: 'customerBulk.job.deleted',
    },
  },
  codeKeyPrefixes: ['customerBulk.codes.', 'customerBulk.skip.'],
  itemLink: (item: BulkJobItem) => {
    if (!item.entityId || item.current === null) return null;
    return { commands: ['/crm/customers', item.entityId] };
  },
  selectFailedRoute: (job: BulkJob) => ({
    commands: ['/crm/customers'],
    queryParams: { bulkJob: job.id, bulkApp: CUSTOMERS_BULK_APP, select: 'failed' },
  }),
  summaryLines: (job: BulkJob) => {
    if (job.action !== 'CREATE_ACTIVITY' || !job.summary) return [];
    const firstRaw = job.summary['firstDueAt'];
    const lastRaw = job.summary['lastDueAt'];
    if (typeof firstRaw !== 'string' || typeof lastRaw !== 'string') return [];
    return [
      {
        key: 'customerBulk.job.firstLast',
        params: {
          first: formatSummaryDateTime(firstRaw),
          last: formatSummaryDateTime(lastRaw),
        },
      },
    ];
  },
  retryOverrides: (job: BulkJob) => (job.action === 'CREATE_ACTIVITY' ? 'START_AT' : null),
};
