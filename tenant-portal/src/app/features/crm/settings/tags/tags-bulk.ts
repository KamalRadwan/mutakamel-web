import { BulkJobModuleDescriptor } from '../../../../shared/bulk-jobs/bulk-job-modules';
import { BulkJob, BulkJobSubmitResult } from '../../../../shared/bulk-jobs/bulk-jobs.model';

export const CRM_TAGS_BULK_MODULE: BulkJobModuleDescriptor = {
  app: 'crm',
  module: 'crm.tags',
  i18nScopes: ['settings-tags'],
  actions: {
    DELETE: {
      titleKey: 'tags.job.delete',
      icon: 'tablerTrash',
      tone: 'red',
      succeededKey: 'tags.job.detached',
    },
  },
  codeKeyPrefixes: ['tags.errors.'],
};

/** Seed the shared tracker immediately; its polling replaces this submit snapshot. */
export function tagDeleteJob(tagId: string, result: BulkJobSubmitResult): BulkJob {
  return {
    id: result.jobId,
    app: 'crm',
    module: CRM_TAGS_BULK_MODULE.module,
    action: 'DELETE',
    scope: {},
    status: result.status,
    total: result.total,
    processed: result.skippedAtSubmit + result.failedAtSubmit,
    counts: {
      succeeded: 0,
      unchanged: 0,
      skipped: result.skippedAtSubmit,
      failed: result.failedAtSubmit,
      cancelled: 0,
    },
    chunkCount: result.chunkCount,
    chunksDone: 0,
    paramsSummary: { tagId },
    ...(result.summary ? { summary: result.summary } : {}),
    createdAt: new Date().toISOString(),
    revision: 0,
  };
}
