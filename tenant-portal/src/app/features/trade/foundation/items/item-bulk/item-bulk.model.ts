import type { TranslocoService } from '@jsverse/transloco';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import {
  BULK_JOB_LIMITS,
  type BulkJob,
  type BulkJobSelection,
  type BulkJobSubmit,
  isBulkJobActive,
} from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError as TradeApiError, type TradeContext } from '../../../shared/trade-api';
import type {
  ItemKind,
  ItemStatus,
  ItemTrackingMode,
  LocalizedNames,
} from '../../../shared/trade-foundation.model';
import type { ItemListFilter } from '../items.model';

export const TRADE_ITEMS_BULK_APP = 'trading' as const;
export const TRADE_ITEMS_BULK_MODULE_NAME = 'trading.items' as const;
export const ITEM_BULK_SELECTION_LIMIT = BULK_JOB_LIMITS.maxItems;

export type ItemBulkAction =
  'SET_STATUS' | 'SET_CATEGORY' | 'ENABLE_FOR_COMPANY' | 'SET_CAPABILITIES';
export type CapabilityChoice = 'KEEP' | 'YES' | 'NO';
/** `channelId` is sent only with the POS purpose: the server rejects a POS query without it (TRADE.CATALOG.CHANNEL_INVALID). */
export type ItemBulkFilter = ItemListFilter & { status?: ItemStatus; channelId?: string };

/** The bulk QUERY filter for a list filter: adds `channelId` whenever the list is filtered for a POS channel. */
export function toItemBulkFilter(
  filter: ItemBulkFilter,
  posChannelId?: string | null,
): ItemBulkFilter {
  const { channelId: _channelId, ...rest } = filter;
  const channelId = posChannelId?.trim();
  return rest.purpose === 'POS' && channelId ? { ...rest, channelId } : rest;
}

export interface SelectedItemRow {
  readonly id: string;
  readonly canonicalCode?: string;
  readonly itemKind?: ItemKind;
  readonly status?: ItemStatus;
  readonly categoryId?: string | null;
  readonly localizedNames?: LocalizedNames;
  readonly version?: number;
}

export interface SetStatusParams {
  status: ItemStatus;
  reasonCodeId?: string | null;
  reasonNote?: string | null;
}

export interface SetCategoryParams {
  categoryId: string | null;
}

export interface EnableForCompanyParams {
  canSell: boolean;
  canPurchase: boolean;
  canPos: boolean;
  trackInventory: boolean;
  trackingMode: ItemTrackingMode;
  salesTaxId: string | null;
  purchaseTaxId: string | null;
}

export interface SetCapabilitiesParams {
  canSell?: boolean;
  canPurchase?: boolean;
  canPos?: boolean;
  trackInventory?: boolean;
}

export interface BulkSubmitOutcome {
  jobId: string;
  finishedJob: BulkJob | null;
}

export interface BulkErrorInfo {
  status: number | null;
  code: string | null;
  details?: Record<string, unknown>;
}

export interface SubmitItemsBulkOptions {
  action: ItemBulkAction;
  context: TradeContext;
  selection: BulkJobSelection;
  params: unknown;
  idempotencyKey: string;
  tracker: BulkJobsTracker;
}

/** Item master actions: the backend handler allows them in tenant scope only (else 403 TRADE.AUTH.TARGET_DENIED). */
export const ITEM_BULK_MASTER_ACTIONS: readonly ItemBulkAction[] = ['SET_STATUS', 'SET_CATEGORY'];

export function isItemBulkMasterAction(action: ItemBulkAction): boolean {
  return ITEM_BULK_MASTER_ACTIONS.includes(action);
}

/** Master actions go out in tenant scope; company actions carry the company (and branch) context. */
export function toBulkScope(
  ctx: TradeContext,
  action?: ItemBulkAction,
): { companyId?: string; branchId?: string } {
  const scope: { companyId?: string; branchId?: string } = {};
  if (action && isItemBulkMasterAction(action)) return scope;
  if (ctx.companyId) scope.companyId = ctx.companyId;
  if (ctx.branchId) scope.branchId = ctx.branchId;
  return scope;
}

export function bulkErrorInfo(error: unknown): BulkErrorInfo {
  if (error instanceof TradeApiError) {
    return { status: error.status, code: error.code, details: error.details };
  }
  if (error && typeof error === 'object') {
    const rec = error as Record<string, unknown>;
    const code = typeof rec['code'] === 'string' ? rec['code'] : null;
    const status = typeof rec['status'] === 'number' ? rec['status'] : null;
    const details =
      rec['details'] && typeof rec['details'] === 'object' && !Array.isArray(rec['details'])
        ? (rec['details'] as Record<string, unknown>)
        : undefined;
    return { status, code, details };
  }
  return { status: null, code: null };
}

export function translateBulkError(
  transloco: TranslocoService,
  code: string | null,
  details?: Record<string, unknown>,
): string {
  const params: Record<string, unknown> = { ...(details ?? {}), max: ITEM_BULK_SELECTION_LIMIT };
  if (code) {
    const underscored = code.replaceAll('.', '_');
    const candidates = [
      `itemsBulk.codes.${code}`,
      `itemsBulk.codes.${underscored}`,
      `tradeShared.errors.${underscored}`,
      `bulkJobs.codes.${code}`,
    ];
    for (const key of candidates) {
      const translated = transloco.translate(key, params);
      if (translated && translated !== key) return translated;
    }
  }
  return transloco.translate('tradeShared.errors.generic');
}

function isActiveConflict(error: unknown): boolean {
  const info = bulkErrorInfo(error);
  return info.status === 409 && info.code === 'BULK_JOB_ACTIVE';
}

/**
 * Submits one items job through the shared tracker (toasts, polling, 409 handling).
 * Resolves null when another job is already running: the tracker has warned and opened it.
 */
export async function submitItemsBulkJob(
  opts: SubmitItemsBulkOptions,
): Promise<BulkSubmitOutcome | null> {
  const { action, context, selection, params, idempotencyKey, tracker } = opts;
  const body: BulkJobSubmit = {
    module: TRADE_ITEMS_BULK_MODULE_NAME,
    action,
    scope: toBulkScope(context, action),
    selection,
    params,
  };

  try {
    const res = await tracker.submit(TRADE_ITEMS_BULK_APP, body, { idempotencyKey });
    const job = tracker
      .jobs()
      .find((entry) => entry.app === TRADE_ITEMS_BULK_APP && entry.id === res.jobId);
    const finishedJob = job && !isBulkJobActive(job.status) ? job : null;
    return { jobId: res.jobId, finishedJob };
  } catch (error) {
    if (isActiveConflict(error)) return null;
    throw error;
  }
}
