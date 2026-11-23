import { ApiError } from '../../../../core/api/api-errors';
import type { CoreQuery, CoreWriteMethod } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import type { CursorPage, InfoPage } from '../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import type { WidgetSummary, WidgetVersionsPage } from '../widgets/widgets.model';
import type {
  AlertEvaluation, AlertRule, CreateAlertRule, ListAlertsQuery, ListEvaluationsQuery,
  PublishedWidgetOption, TestAlertResult, UpdateAlertRule,
} from './alerts.model';

const queryKey = ['crm-analytics', 'alerts'] as const;
const path = '/analytics/alerts';
const pendingWrites = new Map<string, { fingerprint: string; key: string; blocked?: ApiError }>();

function assertManage(): void {
  if (!can('crm.alerts.manage')) throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
}

function read<T>(suffix: string, query: CoreQuery = {}): Promise<T> {
  assertManage();
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, suffix, query], staleTime: 0,
    queryFn: () => crmHttp().read<T>(`${path}${suffix}`, query),
  });
}

async function write<T>(method: CoreWriteMethod, suffix: string, body: unknown, revision?: number, key?: string): Promise<T> {
  assertManage();
  const action = `${method}:${suffix}`;
  const fingerprint = JSON.stringify({ body, revision });
  let pending = pendingWrites.get(action);
  if (!pending || pending.fingerprint !== fingerprint) {
    pending = { fingerprint, key: key ?? newIdempotencyKey() };
    pendingWrites.set(action, pending);
  }
  if (pending.blocked) throw pending.blocked;
  await crmQueries().cancelQueries({ queryKey });
  try {
    const result = await crmHttp().write<T>(method, `${path}${suffix}`, body, {
      key: pending.key,
      ...(revision === undefined ? {} : { ifMatch: `"${revision}"` }),
      ...(method === 'DELETE' ? { query: { revision } } : {}),
    });
    pendingWrites.delete(action);
    return result.data;
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'GW.IDEM.MISMATCH' || error.code.endsWith('_IDEMPOTENCY_MISMATCH') || error.code === 'CRM_IDEMPOTENCY_KEY_REUSED')) {
      pending.blocked = error;
    } else if (!(error instanceof ApiError) || ![0, 401].includes(error.status) && error.status < 500 && error.code !== 'GW.IDEM.IN_FLIGHT') {
      pendingWrites.delete(action);
    }
    throw error;
  } finally {
    await crmQueries().invalidateQueries({ queryKey });
  }
}

/** Explicit reload releases a mismatched action; uncertain writes keep their original key. */
export function resetAlertWriteConflicts(): void {
  for (const [action, pending] of pendingWrites) if (pending.blocked) pendingWrites.delete(action);
}

export function listAlerts(q: ListAlertsQuery = {}): Promise<InfoPage<AlertRule>> {
  return read('', { ...q });
}
export function getAlert(id: string): Promise<AlertRule> {
  return read(`/${encodeURIComponent(id)}`);
}
export function createAlert(body: CreateAlertRule, key: string): Promise<AlertRule> {
  return write('POST', '', body, undefined, key);
}
export function updateAlert(id: string, body: UpdateAlertRule): Promise<AlertRule> {
  return write('PATCH', `/${encodeURIComponent(id)}`, body, body.revision);
}
export function enableAlert(id: string, revision: number): Promise<AlertRule> {
  return write('POST', `/${encodeURIComponent(id)}/enable`, { revision }, revision);
}
export function disableAlert(id: string, revision: number): Promise<AlertRule> {
  return write('POST', `/${encodeURIComponent(id)}/disable`, { revision }, revision);
}
export function resumeAlert(id: string, revision: number): Promise<AlertRule> {
  return write('POST', `/${encodeURIComponent(id)}/resume`, { revision }, revision);
}
export function deleteAlert(id: string, revision: number): Promise<void> {
  return write('DELETE', `/${encodeURIComponent(id)}`, undefined, revision);
}
export function listEvaluations(id: string, q: ListEvaluationsQuery = {}): Promise<InfoPage<AlertEvaluation>> {
  return read(`/${encodeURIComponent(id)}/evaluations`, { ...q });
}
export function testAlert(id: string): Promise<TestAlertResult> {
  assertManage();
  return crmQueries().fetchQuery({
    queryKey: [...queryKey, id, 'test'], staleTime: 0,
    queryFn: async () => (await crmHttp().write<TestAlertResult>('POST', `${path}/${encodeURIComponent(id)}/test`, undefined, { key: newIdempotencyKey() })).data,
  });
}

export async function listPublishedWidgetOptions(): Promise<PublishedWidgetOption[]> {
  assertManage();
  if (!can('crm.widgets.read')) return [];
  const widgets: WidgetSummary[] = [];
  let cursor: string | null = null;
  do {
    const page: CursorPage<WidgetSummary> = await crmQueries().fetchQuery({
      queryKey: [...queryKey, 'widget-options', cursor], staleTime: 0,
      queryFn: () => crmHttp().read('/widgets', { status: 'PUBLISHED', limit: 100, cursor }),
    });
    widgets.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return widgets.flatMap((widget) => {
    const metricKey = widget.querySpec?.series[0]?.metricKey;
    return metricKey && widget.versionNumber !== null ? [{
      id: widget.id, name: { en: widget.name, ar: widget.name }, metricKey,
      activeVersionNumber: widget.versionNumber, versions: [widget.versionNumber],
    }] : [];
  });
}

export async function listAlertWidgetVersions(id: string): Promise<number[]> {
  assertManage();
  const versions: number[] = [];
  let beforeVersion: number | null = null;
  do {
    const page: WidgetVersionsPage = await crmQueries().fetchQuery({
      queryKey: [...queryKey, 'widget-versions', id, beforeVersion], staleTime: 0,
      queryFn: () => crmHttp().read(`/widgets/${encodeURIComponent(id)}/versions`, { beforeVersion, limit: 100 }),
    });
    versions.push(...page.items.map((version) => version.versionNumber));
    beforeVersion = page.nextBeforeVersion;
  } while (beforeVersion !== null);
  return versions;
}
