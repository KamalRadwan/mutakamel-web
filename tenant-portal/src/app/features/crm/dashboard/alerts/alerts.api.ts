import { ApiError, fakeDelay, type InfoPage } from '../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import {
  fakeCreateAlert,
  fakeDeleteAlert,
  fakeDisableAlert,
  fakeEnableAlert,
  fakeGetAlert,
  fakeListAlerts,
  fakeListEvaluations,
  fakeResumeAlert,
  fakeTestAlert,
  fakeUpdateAlert,
} from './alerts.fake';
// Components read these through the api layer, never from the fake module.
export { EMAIL_CHANNEL_AVAILABLE, FAKE_PUBLISHED_WIDGETS as PUBLISHED_WIDGET_OPTIONS } from './alerts.fake';
import type {
  AlertEvaluation,
  AlertRule,
  CreateAlertRule,
  ListAlertsQuery,
  ListEvaluationsQuery,
  TestAlertResult,
  UpdateAlertRule,
} from './alerts.model';

// Contract: crm-app governance/alerts (alerts.controller.ts). {B} = /api/v1/crm. Every route needs crm.alerts.manage.
/** RequirePermissions guard: 403 CRM_PERMISSION_DENIED. */
function assertManagePermission(): void {
  if (!can('crm.alerts.manage')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
}

// GET {B}/analytics/alerts
export async function listAlerts(q: ListAlertsQuery = {}): Promise<InfoPage<AlertRule>> {
  await fakeDelay();
  assertManagePermission();
  return structuredClone(fakeListAlerts(q));
}

// GET {B}/analytics/alerts/:id
export async function getAlert(id: string): Promise<AlertRule> {
  await fakeDelay();
  assertManagePermission();
  return structuredClone(fakeGetAlert(id));
}

// POST {B}/analytics/alerts (header x-idempotency-key; the gateway requires a UUIDv7, crm-app keeps the receipt)
export async function createAlert(body: CreateAlertRule, key: string): Promise<AlertRule> {
  await fakeDelay();
  assertManagePermission();
  return structuredClone(fakeCreateAlert(body, key));
}

// PATCH {B}/analytics/alerts/:id
export async function updateAlert(id: string, body: UpdateAlertRule): Promise<AlertRule> {
  await fakeDelay();
  assertManagePermission();
  return structuredClone(fakeUpdateAlert(id, body));
}

// POST {B}/analytics/alerts/:id/enable
export async function enableAlert(id: string, revision: number): Promise<AlertRule> {
  await fakeDelay();
  assertManagePermission();
  return structuredClone(fakeEnableAlert(id, revision));
}

// POST {B}/analytics/alerts/:id/disable
export async function disableAlert(id: string, revision: number): Promise<AlertRule> {
  await fakeDelay();
  assertManagePermission();
  return structuredClone(fakeDisableAlert(id, revision));
}

// POST {B}/analytics/alerts/:id/resume
export async function resumeAlert(id: string, revision: number): Promise<AlertRule> {
  await fakeDelay();
  assertManagePermission();
  return structuredClone(fakeResumeAlert(id, revision));
}

// DELETE {B}/analytics/alerts/:id?revision=  204
export async function deleteAlert(id: string, revision: number): Promise<void> {
  await fakeDelay();
  assertManagePermission();
  fakeDeleteAlert(id, revision);
}

// GET {B}/analytics/alerts/:id/evaluations
export async function listEvaluations(
  id: string,
  q: ListEvaluationsQuery = {},
): Promise<InfoPage<AlertEvaluation>> {
  await fakeDelay();
  assertManagePermission();
  return structuredClone(fakeListEvaluations(id, q));
}

// POST {B}/analytics/alerts/:id/test
export async function testAlert(id: string): Promise<TestAlertResult> {
  await fakeDelay();
  assertManagePermission();
  return structuredClone(fakeTestAlert(id));
}
