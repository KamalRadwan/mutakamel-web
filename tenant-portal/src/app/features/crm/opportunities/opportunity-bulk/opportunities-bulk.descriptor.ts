import { BulkJobModuleDescriptor } from '../../../../shared/bulk-jobs/bulk-job-modules';
import { BulkJob, BulkJobItem } from '../../../../shared/bulk-jobs/bulk-jobs.model';

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

export const CRM_OPPORTUNITIES_BULK_MODULE: BulkJobModuleDescriptor = {
  app: 'crm',
  module: 'crm.opportunities',
  i18nScopes: ['opportunity-bulk'],
  actions: {
    ASSIGN: {
      titleKey: 'oppBulk.job.ASSIGN',
      icon: 'tablerUserShare',
      tone: 'blue',
      succeededKey: 'oppBulk.job.assigned',
    },
    MOVE_STAGE: {
      titleKey: 'oppBulk.job.MOVE_STAGE',
      icon: 'tablerArrowsExchange',
      tone: 'green',
      succeededKey: 'oppBulk.job.moved',
    },
    CREATE_ACTIVITY: {
      titleKey: 'oppBulk.job.CREATE_ACTIVITY',
      icon: 'tablerCalendarPlus',
      tone: 'teal',
      succeededKey: 'oppBulk.job.created',
    },
    DELETE: {
      titleKey: 'oppBulk.job.DELETE',
      icon: 'tablerTrash',
      tone: 'red',
      succeededKey: 'oppBulk.job.deleted',
    },
  },
  codeKeyPrefixes: ['oppBulk.codes.'],
  itemLink: (item: BulkJobItem) => {
    if (!item.entityId || item.current === null) return null;
    return { commands: ['/crm/opportunities', item.entityId] };
  },
  selectFailedRoute: (job: BulkJob) => ({
    commands: ['/crm/opportunities'],
    queryParams: { bulkJob: job.id, bulkApp: 'crm', select: 'failed', view: 'table' },
  }),
  summaryLines: (job: BulkJob) => {
    if (job.action !== 'CREATE_ACTIVITY' || !job.summary) return [];
    const firstRaw = job.summary['firstDueAt'];
    const lastRaw = job.summary['lastDueAt'];
    if (typeof firstRaw !== 'string' || typeof lastRaw !== 'string') return [];
    return [
      {
        key: 'oppBulk.job.firstLast',
        params: {
          first: formatSummaryDateTime(firstRaw),
          last: formatSummaryDateTime(lastRaw),
        },
      },
    ];
  },
  retryOverrides: (job: BulkJob) => (job.action === 'CREATE_ACTIVITY' ? 'START_AT' : null),
};
