import {
  ApplyErrorKind,
  BadgeTone,
  ComponentRisk,
  Eligibility,
  KNOWN_OPERATION_STATUSES,
  MAX_SELECTIONS,
  OperationStatus,
  SnapshotItem,
  TERMINAL_STATUSES,
  TenantAvailableUpdate,
  UpdateSelection,
} from './updates.model';

export const COMPONENT_KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$/;
export const COMPONENT_KEY_MAX_LENGTH = 96;

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

const STALE_APPLY_ERROR_CODES = new Set([
  'TENANT_PROVISIONING_UPDATE_SELECTION_STALE',
  'TENANT_PROVISIONING_PLAN_STALE',
  'TENANT_PROVISIONING_OPERATION_SUPERSEDED',
  'TENANT_PROVISIONING_ADDON_REBIND_REQUIRED',
  'TENANT_PROVISIONING_UPDATE_INCOMPATIBLE',
]);

const AMBIGUOUS_ERROR_CODES = new Set([
  'NETWORK',
  'NETWORK_ERROR',
  'NETWORK_AFTER_COMMIT',
  'IDEMPOTENCY_REQUEST_PROCESSING',
]);

export function isValidComponentKey(value: string): boolean {
  return value.length > 0 && value.length <= COMPONENT_KEY_MAX_LENGTH && COMPONENT_KEY_PATTERN.test(value);
}

export function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_V7_PATTERN.test(value);
}

export function isSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_PATTERN.test(value);
}

export function eligibilityOf(row: TenantAvailableUpdate): Eligibility {
  if (row.updateAlreadyPlanned) {
    return 'PLANNED';
  }
  if (!row.availableRelease.selfServiceAllowed) {
    return 'ADMIN_MANAGED';
  }
  if (row.availableRelease.requiresBackup || row.availableRelease.requiresMaintenance) {
    return 'NEEDS_BACKUP_OR_MAINTENANCE';
  }
  const releaseVersion = row.availableRelease.releaseVersion;
  if (
    !isValidComponentKey(row.componentKey) ||
    !isUuidV7(row.current.releaseId) ||
    !isSha256(row.current.manifestChecksum) ||
    !isUuidV7(row.availableRelease.id) ||
    !isSha256(row.availableRelease.manifestChecksum) ||
    typeof releaseVersion !== 'string' ||
    releaseVersion.length < 1 ||
    releaseVersion.length > 120
  ) {
    return 'INCOMPLETE_EVIDENCE';
  }
  return 'ELIGIBLE';
}

export function buildSnapshot(rows: readonly TenantAvailableUpdate[]): SnapshotItem[] {
  const seen = new Set<string>();
  const items: SnapshotItem[] = [];

  for (const row of rows) {
    if (items.length >= MAX_SELECTIONS) break;
    if (seen.has(row.componentKey)) continue;
    if (eligibilityOf(row) !== 'ELIGIBLE') continue;

    seen.add(row.componentKey);
    items.push({
      selection: {
        componentKey: row.componentKey,
        targetReleaseId: row.availableRelease.id,
        targetReleaseVersion: row.availableRelease.releaseVersion,
        targetManifestChecksum: row.availableRelease.manifestChecksum,
        currentAppliedReleaseId: row.current.releaseId,
        currentAppliedManifestChecksum: row.current.manifestChecksum!,
      },
      ownerApp: row.ownerApp,
      currentVersion: row.current.releaseVersion,
      riskLevel: row.availableRelease.riskLevel,
      requiresBackup: row.availableRelease.requiresBackup,
      requiresMaintenance: row.availableRelease.requiresMaintenance,
    });
  }

  return items;
}

export function toApplySelections(snapshot: readonly SnapshotItem[]): UpdateSelection[] {
  return snapshot.map((item) => ({ ...item.selection }));
}

export function snapshotDiverges(
  snapshot: readonly SnapshotItem[],
  liveRows: readonly TenantAvailableUpdate[],
): boolean {
  if (snapshot.length === 0) return false;
  const byKey = new Map<string, TenantAvailableUpdate>();
  for (const row of liveRows) {
    byKey.set(row.componentKey, row);
  }

  for (const item of snapshot) {
    const live = byKey.get(item.selection.componentKey);
    if (!live) return true;
    if (eligibilityOf(live) !== 'ELIGIBLE') return true;

    const pin = item.selection;
    if (
      live.componentKey !== pin.componentKey ||
      live.availableRelease.id !== pin.targetReleaseId ||
      live.availableRelease.releaseVersion !== pin.targetReleaseVersion ||
      live.availableRelease.manifestChecksum !== pin.targetManifestChecksum ||
      live.current.releaseId !== pin.currentAppliedReleaseId ||
      live.current.manifestChecksum !== pin.currentAppliedManifestChecksum
    ) {
      return true;
    }
  }

  return false;
}

function readStatusAndCode(error: unknown): { status: number | null; code: string | null } {
  if (!error || typeof error !== 'object') {
    return { status: null, code: null };
  }
  const rec = error as { status?: unknown; code?: unknown; message?: unknown };
  const status = typeof rec.status === 'number' ? rec.status : null;
  const code =
    typeof rec.code === 'string'
      ? rec.code
      : typeof rec.message === 'string' && rec.message === rec.message.toUpperCase()
        ? rec.message
        : null;
  return { status, code };
}

export function classifyApplyError(error: unknown): ApplyErrorKind {
  const { status, code } = readStatusAndCode(error);

  if (code && STALE_APPLY_ERROR_CODES.has(code)) {
    return 'stale';
  }
  if (code === 'TENANT_PROVISIONING_OPERATION_STATE_INVALID') {
    return 'blocked';
  }
  if (code === 'TENANT_PROVISIONING_NO_SELF_SERVICE_UPDATES') {
    return 'refused';
  }
  if (status === 202 && code === 'RESPONSE_UNREADABLE') {
    return 'unreadable';
  }
  if (status === 403 || code === 'FORBIDDEN' || code === 'PERMISSION_DENIED') {
    return 'forbidden';
  }
  if (
    status === 0 ||
    (code !== null && AMBIGUOUS_ERROR_CODES.has(code)) ||
    status === 429 ||
    (status === 503 && code !== 'TENANT_PROVISIONING_CATALOG_INVALID')
  ) {
    return 'ambiguous';
  }
  return 'toast';
}

export function isTerminal(status: OperationStatus | string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function statusTone(status: OperationStatus | string): BadgeTone {
  switch (status) {
    case 'SUCCEEDED':
      return 'success';
    case 'REQUESTED':
    case 'PLANNING':
    case 'QUEUED':
    case 'RUNNING':
      return 'brand';
    case 'WAITING_RETRY':
    case 'CANCEL_REQUESTED':
    case 'MANUAL_RECOVERY_REQUIRED':
      return 'warning';
    case 'FAILED_RETRYABLE':
      return 'danger';
    case 'CANCELLED':
    default:
      return 'neutral';
  }
}

export function riskTone(risk: ComponentRisk): BadgeTone {
  switch (risk) {
    case 'LOW':
      return 'success';
    case 'MEDIUM':
      return 'warning';
    case 'HIGH':
      return 'danger';
  }
}

export function badgeClassForTone(tone: BadgeTone): string {
  switch (tone) {
    case 'success':
      return 'bg-success text-on-success';
    case 'brand':
      return 'bg-brand-soft text-on-brand-soft';
    case 'warning':
      return 'bg-warning text-on-warning';
    case 'danger':
      return 'bg-danger text-on-danger';
    case 'neutral':
      return 'bg-neutral-soft text-text-muted';
  }
}

export function eligibilityBadgeClass(eligibility: Eligibility): string {
  switch (eligibility) {
    case 'ELIGIBLE':
      return 'bg-success-soft text-on-success-soft';
    case 'PLANNED':
      return 'bg-warning text-on-warning';
    case 'ADMIN_MANAGED':
    case 'NEEDS_BACKUP_OR_MAINTENANCE':
      return 'bg-neutral-soft text-on-neutral-soft';
    case 'INCOMPLETE_EVIDENCE':
      return 'bg-neutral-soft text-text-muted';
  }
}

export function statusLabelKey(status: string): string {
  return KNOWN_OPERATION_STATUSES.has(status)
    ? `wsUpdates.status.${status}`
    : 'wsUpdates.status.unknown';
}

export function guidanceKeyForStatus(status: string): string | null {
  switch (status) {
    case 'REQUESTED':
    case 'PLANNING':
    case 'QUEUED':
    case 'RUNNING':
      return 'wsUpdates.guidance.RUNNING';
    case 'WAITING_RETRY':
    case 'CANCEL_REQUESTED':
    case 'SUCCEEDED':
    case 'CANCELLED':
    case 'FAILED_RETRYABLE':
    case 'MANUAL_RECOVERY_REQUIRED':
      return `wsUpdates.guidance.${status}`;
    default:
      return null;
  }
}

export function findInitialTrackedOperationId(rows: readonly TenantAvailableUpdate[]): string | null {
  for (const row of rows) {
    if (
      row.updateAlreadyPlanned &&
      row.desiredReleaseId === row.availableRelease.id &&
      row.lastOperationId
    ) {
      return row.lastOperationId;
    }
  }
  return null;
}

export function shortChecksum(checksum: string): string {
  return checksum.length > 12 ? `${checksum.slice(0, 12)}…` : checksum;
}

export function formatDateTime(iso: string, lang: 'ar' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const locale = `${lang}-u-nu-latn`;
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${dateFmt.format(date)} · ${timeFmt.format(date)}`;
}
