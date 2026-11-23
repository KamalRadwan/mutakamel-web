import type { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../shared/trade-api';
import { formatDate } from '../shared/trade-format';
import {
  type TowerException,
  type TowerSource,
  type TowerSourceRoute,
  allowedCodesFor,
} from './tower.model';

const TIME_24_EN = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const TIME_24_AR = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatTowerDateTime(
  iso: string | null | undefined,
  lang: 'en' | 'ar',
  noneLabel = '—',
): string {
  if (!iso || !iso.trim()) return noneLabel;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return noneLabel;
  const datePart = formatDate(iso, lang);
  const timePart = (lang === 'ar' ? TIME_24_AR : TIME_24_EN).format(date);
  return `${datePart} ${timePart}`;
}

function translateKeyIfPresent(transloco: TranslocoService, key: string): string | null {
  const text = transloco.translate(key);
  return text && text !== key ? text : null;
}

export function formatTowerSafeErrorCode(
  code: string | null | undefined,
  noneLabel = '—',
): string {
  if (!code || !code.trim()) return noneLabel;
  return code.trim();
}

export function translateTowerProblem(
  _transloco: TranslocoService,
  code: string | null | undefined,
  noneLabel = '—',
): string {
  return formatTowerSafeErrorCode(code, noneLabel);
}

export function translateTowerError(transloco: TranslocoService, error: unknown): string {
  if (!(error instanceof ApiError)) {
    return transloco.translate('tower.errors.network');
  }

  const reason = error.details?.['reason']?.[0];
  const normCode = error.code.replaceAll('.', '_');
  const normReason = reason ? reason.replaceAll('.', '_') : null;
  const candidates: string[] = [];

  if (reason && normReason) {
    candidates.push(
      `tower.errors.${normCode}_${normReason}`,
      `automation.errors.${error.code}.${reason}`,
      `automation.errors.${normCode}_${normReason}`,
    );
  }
  candidates.push(
    `tower.errors.${normCode}`,
    `automation.errors.${error.code}`,
    `automation.errors.${normCode}`,
    `tradeShared.errors.${normCode}`,
    `bulkJobs.codes.${error.code}`,
    `bulkJobs.codes.${normCode}`,
  );

  for (const key of candidates) {
    const found = translateKeyIfPresent(transloco, key);
    if (found) return found;
  }

  return transloco.translate('tower.errors.generic');
}

/**
 * Maps the backend `source.link` ({kind, id, parentId}) to router commands. Sources without a link
 * (deleted, missing, or a document type with no supported link kind) return null.
 */
export function towerSourceRoute(source: TowerSource | null | undefined): TowerSourceRoute | null {
  const link = source?.link;
  if (!link) return null;
  switch (link.kind) {
    case 'DOCUMENT_PROFILE_VERSION':
      return link.parentId
        ? { commands: ['/trade/governance/document-profiles', link.parentId, 'versions', link.id] }
        : { commands: ['/trade/governance/document-profiles'], queryParams: { version: link.id } };
    case 'QUOTATION':
      return { commands: ['/trade/documents/quotations', link.id] };
    case 'SALES_ORDER':
      return { commands: ['/trade/documents/sales-orders', link.id] };
    case 'PURCHASE_ORDER':
      return { commands: ['/trade/documents/purchase-orders', link.id] };
    default:
      return null;
  }
}

export function resolveTowerSourceLink(ex: TowerException): TowerSourceRoute | null {
  return towerSourceRoute(ex.source);
}

/** Row label: the backend label, else the document number, else the raw source id. */
export function towerSourceLabel(ex: TowerException): string {
  return ex.source?.label || ex.source?.documentNumber || ex.sourceId;
}

export function isTowerRowSelectable(ex: TowerException): boolean {
  return allowedCodesFor(ex).length > 0;
}
