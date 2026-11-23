import { BulkJobModuleDescriptor } from '../../../../../shared/bulk-jobs/bulk-job-modules';

export const CORE_USERS_BULK_MODULE: BulkJobModuleDescriptor = {
  app: 'core',
  module: 'core.users',
  i18nScopes: ['staff-users'],
  actions: {
    ASSIGN_ROLE: {
      titleKey: 'users.bulk.assignRole',
      succeededKey: 'users.bulk.updated',
      icon: 'tablerUserShare',
      tone: 'blue',
    },
    IMPORT: {
      titleKey: 'users.import.title',
      succeededKey: 'users.import.created',
      icon: 'tablerUpload',
      tone: 'blue',
    },
  },
  codeKeyPrefixes: ['users.errors.'],
  itemLink: (item, job) => {
    const id = job.action === 'IMPORT' ? item.refId : item.entityId;
    return id ? { commands: ['/workspace/staff/users', id] } : null;
  },
};
