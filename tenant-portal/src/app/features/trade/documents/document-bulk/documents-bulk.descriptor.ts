import type { BulkJobActionDescriptor, BulkJobModuleDescriptor } from '../../../../shared/bulk-jobs/bulk-job-modules';
import { type BulkJob, type BulkJobItem, isBulkJobActive } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { KIND_CONFIG } from '../shared/document-kinds';
import type { DocumentKind } from '../shared/document.model';
import { errorCodeOf } from '../../shared/trade-api';
import type { BulkPrintArtifact } from '../shared/documents.api';

export type DocumentBulkAction = 'SEND' | 'HOLD' | 'RELEASE_HOLD' | 'SUBMIT' | 'ISSUE' | 'PRINT' | 'CANCEL';

export type DocumentBulkKindKey = 'quotation' | 'salesOrder' | 'purchaseOrder' | 'purchaseQuotation';

export type DocumentBulkReasonKind = 'DOCUMENT_CANCEL' | 'DOCUMENT_HOLD' | 'DOCUMENT_HOLD_RELEASE';

export const KIND_I18N_KEY: Readonly<Record<DocumentKind, DocumentBulkKindKey>> = {
  quotation: 'quotation',
  'sales-order': 'salesOrder',
  'purchase-order': 'purchaseOrder',
  'purchase-quotation': 'purchaseQuotation',
};

export interface DocumentBulkActionSpec {
  id: DocumentBulkAction;
  icon: string;
  tile: string;
  tone: BulkJobActionDescriptor['tone'];
  placement: 'bar' | 'menu';
  danger?: boolean;
  reasonKind?: DocumentBulkReasonKind;
}

const PRINT_ACTION: DocumentBulkActionSpec = {
  id: 'PRINT',
  icon: 'tablerPrinter',
  tile: 'bg-icon-violet',
  tone: 'violet',
  placement: 'bar',
};

const CANCEL_ACTION: DocumentBulkActionSpec = {
  id: 'CANCEL',
  icon: 'tablerBan',
  tile: 'bg-icon-red',
  tone: 'red',
  placement: 'menu',
  danger: true,
  reasonKind: 'DOCUMENT_CANCEL',
};

export const DOCUMENT_BULK_ACTIONS: Readonly<Record<DocumentKind, readonly DocumentBulkActionSpec[]>> = {
  quotation: [
    {
      id: 'SEND',
      icon: 'tablerSend',
      tile: 'bg-icon-blue',
      tone: 'blue',
      placement: 'bar',
    },
    PRINT_ACTION,
    CANCEL_ACTION,
  ],
  'sales-order': [
    {
      id: 'HOLD',
      icon: 'tablerPlayerPause',
      tile: 'bg-icon-orange',
      tone: 'amber',
      placement: 'bar',
      reasonKind: 'DOCUMENT_HOLD',
    },
    {
      id: 'RELEASE_HOLD',
      icon: 'tablerPlayerPlay',
      tile: 'bg-icon-teal',
      tone: 'teal',
      placement: 'bar',
      reasonKind: 'DOCUMENT_HOLD_RELEASE',
    },
    PRINT_ACTION,
    CANCEL_ACTION,
  ],
  'purchase-order': [
    {
      id: 'SUBMIT',
      icon: 'tablerSend',
      tile: 'bg-icon-blue',
      tone: 'blue',
      placement: 'bar',
    },
    PRINT_ACTION,
    CANCEL_ACTION,
  ],
  'purchase-quotation': [
    {
      id: 'ISSUE',
      icon: 'tablerRubberStamp',
      tile: 'bg-icon-blue',
      tone: 'blue',
      placement: 'bar',
    },
    PRINT_ACTION,
    CANCEL_ACTION,
  ],
};

export const BULK_PRINT_NOT_READY_CODE = 'TRADE.BULK_JOB.ARTIFACT_NOT_READY';

export type BulkPrintArtifactResult =
  | { ready: true; artifact: BulkPrintArtifact }
  | { ready: false; messageKey: `td.errors.${typeof BULK_PRINT_NOT_READY_CODE}` };

/** A file that is not ready yet is an expected state (show the message, let the user try again), not a failure. */
export async function openBulkPrintArtifact(jobId: string): Promise<BulkPrintArtifactResult> {
  const { getBulkPrintArtifact } = await import('../shared/documents.api');
  let artifact: BulkPrintArtifact;
  try {
    artifact = await getBulkPrintArtifact(jobId);
  } catch (error) {
    if (errorCodeOf(error) === BULK_PRINT_NOT_READY_CODE) {
      return { ready: false, messageKey: `td.errors.${BULK_PRINT_NOT_READY_CODE}` };
    }
    throw error;
  }
  if (typeof window !== 'undefined' && artifact.downloadUrl) {
    window.open(artifact.downloadUrl, '_blank', 'noopener');
  }
  return { ready: true, artifact };
}

const ALL_DOCUMENT_KINDS: readonly DocumentKind[] = [
  'quotation',
  'sales-order',
  'purchase-order',
  'purchase-quotation',
];

function buildModuleDescriptor(kind: DocumentKind): BulkJobModuleDescriptor {
  const segment = KIND_CONFIG[kind].segment;
  const kindKey = KIND_I18N_KEY[kind];
  const actions: Record<string, BulkJobActionDescriptor> = {};

  for (const spec of DOCUMENT_BULK_ACTIONS[kind]) {
    actions[spec.id] = {
      titleKey: `tdb.job.${kindKey}.${spec.id}`,
      icon: spec.icon,
      tone: spec.tone,
      succeededKey: `tdb.job.${kindKey}.succeeded.${spec.id}`,
    };
  }

  return {
    app: 'trading',
    module: `trading.${segment}`,
    i18nScopes: ['trade-documents', 'trade-documents-bulk'],
    actions,
    codeKeyPrefixes: ['td.errors.'],
    itemLink: (item: BulkJobItem) => {
      if (!item.entityId || item.current === null) return null;
      return { commands: ['/trade/documents', segment, item.entityId] };
    },
    // P1 does not support ?ids= selection restoration yet.
    selectFailedRoute: () => null,
    // The ZIP is built only after the job ends, from the succeeded PDFs; with none there is no ZIP.
    summaryLines: (job: BulkJob) => {
      if (job.action !== 'PRINT' || isBulkJobActive(job.status)) return [];
      if (job.counts.succeeded <= 0) return [{ key: 'tdb.job.printNoZip', params: {} }];
      return [{ key: 'tdb.job.printDownload', params: { count: job.counts.succeeded } }];
    },
  };
}

export const TRADE_DOCUMENT_BULK_MODULES: BulkJobModuleDescriptor[] = ALL_DOCUMENT_KINDS.map(buildModuleDescriptor);
