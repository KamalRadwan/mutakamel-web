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

export const CRM_LEADS_BULK_MODULE: BulkJobModuleDescriptor = {
  app: 'crm',
  module: 'crm.leads',
  i18nScopes: ['lead-bulk-actions', 'lead-bulk-activity'],
  actions: {
    ASSIGN: {
      titleKey: 'leadBulk.job.ASSIGN',
      icon: 'tablerUserShare',
      tone: 'blue',
      succeededKey: 'leadBulk.job.updated',
    },
    MOVE_STAGE: {
      titleKey: 'leadBulk.job.MOVE_STAGE',
      icon: 'tablerArrowsExchange',
      tone: 'green',
      succeededKey: 'leadBulk.job.moved',
    },
    CREATE_ACTIVITY: {
      titleKey: 'leadBulk.job.CREATE_ACTIVITY',
      icon: 'tablerCalendarPlus',
      tone: 'teal',
      succeededKey: 'leadBulk.job.created',
    },
    DELETE: {
      titleKey: 'leadBulk.job.DELETE',
      icon: 'tablerTrash',
      tone: 'red',
      succeededKey: 'leadBulk.job.deleted',
    },
  },
  codeKeyPrefixes: ['leadBulk.codes.', 'leadBulk.skip.', 'bulkAct.codes.'],
  itemLink: (item: BulkJobItem) => {
    if (!item.entityId || item.current === null) return null;
    return { commands: ['/crm/leads', item.entityId] };
  },
  selectFailedRoute: (job: BulkJob) => ({
    commands: ['/crm/leads'],
    queryParams: { bulkJob: job.id, bulkApp: 'crm', select: 'failed' },
  }),
  summaryLines: (job: BulkJob) => {
    if (job.action !== 'CREATE_ACTIVITY' || !job.summary) return [];
    const firstRaw = job.summary['firstDueAt'];
    const lastRaw = job.summary['lastDueAt'];
    if (typeof firstRaw !== 'string' || typeof lastRaw !== 'string') return [];
    return [
      {
        key: 'leadBulk.job.firstLast',
        params: {
          first: formatSummaryDateTime(firstRaw),
          last: formatSummaryDateTime(lastRaw),
        },
      },
    ];
  },
  retryOverrides: (job: BulkJob) => (job.action === 'CREATE_ACTIVITY' ? 'START_AT' : null),
};
