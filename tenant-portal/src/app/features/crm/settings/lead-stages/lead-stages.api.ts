import { InjectionToken } from '@angular/core';
import { ApiError } from '../../../../core/api/api-errors';
import type { CoreWriteMethod } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../../shared/crm-http';
import { getCrmSettings } from '../general/general.api';
import type { CrmSettings } from '../general/general.model';
import { CreateLeadStageInput, LeadStage, UpdateLeadStagePatch } from './lead-stages.model';

const queryKey = ['crm-settings', 'lead-stages'] as const;
const retries = new WeakMap<
  CrmHttpTransport,
  Map<string, { key: string; bodyJson: string | undefined }>
>();
let conversionRequiresQualified = false;
export const LEAD_STAGE_SETTINGS_READER = new InjectionToken<() => Promise<CrmSettings>>(
  'Lead stage settings reader',
  { factory: () => getCrmSettings },
);

/** GET /api/tenant/crm/v1/lead-stages */
export function listLeadStages(): Promise<LeadStage[]> {
  return crmQueries().fetchQuery({
    queryKey,
    queryFn: () => crmHttp().read<LeadStage[]>('/lead-stages'),
  });
}

/** POST /api/tenant/crm/v1/lead-stages */
export function createLeadStage(input: CreateLeadStageInput): Promise<LeadStage> {
  return writeStage('POST', '/lead-stages', input);
}

/** PATCH /api/tenant/crm/v1/lead-stages/:id */
export function updateLeadStage(id: string, patch: UpdateLeadStagePatch): Promise<LeadStage> {
  return writeStage('PATCH', `/lead-stages/${id}`, patch);
}

/** POST /api/tenant/crm/v1/lead-stages/:id/default */
export function setDefaultLeadStage(id: string): Promise<LeadStage> {
  return writeStage('POST', `/lead-stages/${id}/default`, undefined);
}

/** PATCH /api/tenant/crm/v1/lead-stages/reorder (header x-idempotency-key: one per reorder, the same on a retry) */
export function reorderLeadStages(
  orderedIds: readonly string[],
  idempotencyKey: string,
): Promise<LeadStage[]> {
  return writeStage('PATCH', '/lead-stages/reorder', { orderedIds }, idempotencyKey);
}

/** DELETE /api/tenant/crm/v1/lead-stages/:id */
export function deleteLeadStage(id: string): Promise<void> {
  return writeStage('DELETE', `/lead-stages/${id}`, undefined);
}

/** Opening another form starts a new action, even if the last response was lost. */
export function beginLeadStageEdit(id: string | null): void {
  retries.get(crmHttp())?.delete(id ? `PATCH /lead-stages/${id}` : 'POST /lead-stages');
}

/** Retains the synchronous signature; false until a permitted settings read succeeds. */
export function requireQualifiedForConversion(): boolean {
  return conversionRequiresQualified;
}

/** The page checks crm.settings.read before this optional, independent read. */
export async function loadQualifiedConversionRequirement(
  readSettings: () => Promise<CrmSettings> = getCrmSettings,
): Promise<boolean> {
  conversionRequiresQualified = false;
  try {
    conversionRequiresQualified = (await readSettings()).requireQualifiedStageForConversion;
  } catch {
    // An unavailable optional warning must not prevent using the catalogue.
  }
  return requireQualifiedForConversion();
}

async function writeStage<T>(
  method: CoreWriteMethod,
  path: string,
  body: unknown,
  suppliedKey?: string,
): Promise<T> {
  const http = crmHttp();
  let pending = retries.get(http);
  if (!pending) retries.set(http, (pending = new Map()));
  const action = `${method} ${path}`;
  const bodyJson = JSON.stringify(body);
  const previous = pending.get(action);
  const key = previous
    ? previous.bodyJson === bodyJson
      ? previous.key
      : newIdempotencyKey()
    : (suppliedKey ?? newIdempotencyKey());
  pending.delete(action);
  let data: T;
  try {
    data = (await http.write<T>(method, path, body, { key })).data;
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 0 ||
        error.status >= 500 ||
        error.status === 401 ||
        error.code === 'GW.IDEM.IN_FLIGHT')
    ) {
      pending.set(action, { key, bodyJson });
    }
    throw error;
  }
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
  return data;
}
