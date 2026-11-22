import type { BulkJobModuleDescriptor } from '../../../../../shared/bulk-jobs/bulk-job-modules';
import type { BulkJobItem } from '../../../../../shared/bulk-jobs/bulk-jobs.model';

export const TRADE_ACCOUNTS_BULK_MODULE_ID = 'trading.commercial-accounts';

export type TradeAccountsBulkAction = 'BLOCK' | 'UNBLOCK';

/**
 * Same params as the backend handler schemas (trade-accounts-bulk.schemas.ts): the reason note is `note`
 * (the handler maps it to reasonNote), `evidenceRef` is BLOCK only, and unknown keys are rejected.
 */
export interface TradeAccountsBulkParams {
  reasonCodeId: string;
  note?: string;
  evidenceRef?: string;
}

/** Backend BlockAccountParams.evidenceRef: @MaxLength(200). */
export const TRADE_ACCOUNTS_BULK_EVIDENCE_MAX = 200;
/** Backend UnblockAccountParams.note: @MaxLength(500). */
export const TRADE_ACCOUNTS_BULK_NOTE_MAX = 500;

export const TRADE_ACCOUNTS_BULK_MODULE: BulkJobModuleDescriptor = {
  app: 'trading',
  module: TRADE_ACCOUNTS_BULK_MODULE_ID,
  i18nScopes: ['trade-accounts-bulk'],
  actions: {
    BLOCK: {
      titleKey: 'accountsBulk.action.BLOCK',
      icon: 'tablerLock',
      tone: 'red',
      succeededKey: 'accountsBulk.succeeded',
    },
    UNBLOCK: {
      titleKey: 'accountsBulk.action.UNBLOCK',
      icon: 'tablerLockOpen',
      tone: 'green',
      succeededKey: 'accountsBulk.succeeded',
    },
  },
  codeKeyPrefixes: ['accountsBulk.codes.'],
  toasts: {
    startedKey: 'accountsBulk.started',
  },
  itemLink: (item: BulkJobItem) => {
    if (!item.entityId || item.current === null) return null;
    return {
      commands: ['/trade/foundation/commercial-accounts'],
      queryParams: { account: item.entityId },
    };
  },
};
