import { TranslocoService } from '@jsverse/transloco';
import {
  ActivityDirection,
  ActivityPriority,
  ActivityType,
} from '../../../../shared/widgets/activities/activities.model';
import { ApiError } from '../../settings/shared/settings-api';
import { CustomerSort, CustomerStatus, ManualCustomerStatus } from '../customers.model';

export const CUSTOMER_SELECTION_LIMIT = 10_000;
export const CUSTOMER_DELETE_TYPED_CONFIRM_FROM = 50;
export const CUSTOMERS_BULK_APP = 'crm' as const;
export const CUSTOMERS_BULK_MODULE_ID = 'crm.customer_profiles';
export const CUSTOMER_BULK_REASON_MAX = 1000;

export type CustomerBulkAction = 'ASSIGN' | 'SET_STATUS' | 'CREATE_ACTIVITY' | 'DELETE';
export type CustomerBulkSort = CustomerSort;

export interface SelectedCustomerRow {
  id: string;
  displayName: string;
  ownerUserId: string | null;
  status: CustomerStatus;
  updatedAt: string;
}

export interface CustomerSelectionResult {
  items: SelectedCustomerRow[];
  total: number;
  truncated: boolean;
}

export interface CustomerBulkAssignParams {
  ownerUserId: string;
}

export interface CustomerBulkSetStatusParams {
  status: ManualCustomerStatus;
}

export interface CustomerBulkDeleteParams {
  reason?: string | null;
}

export type CustomerBulkActivityAssignee =
  | { mode: 'LEAD_OWNER' }
  | { mode: 'ME' }
  | { mode: 'USER'; userId: string };

export interface CustomerBulkActivityParams {
  activity: {
    type: ActivityType;
    subject: string;
    description?: string;
    direction?: ActivityDirection;
    priority?: ActivityPriority;
    reminderOffsetMinutes?: number;
    location?: string;
    meetingUrl?: string;
    durationMinutes: number | null;
  };
  schedule: {
    startAt: string;
    gapMinutes: number;
    order: 'TABLE' | 'OWNER';
    assignee: CustomerBulkActivityAssignee;
    spacePerAssignee: boolean;
  };
}

function formatSelectionMax(value: unknown): string {
  const num = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(num) || num <= 0) {
    return CUSTOMER_SELECTION_LIMIT.toLocaleString();
  }
  return num.toLocaleString();
}

export function extractBulkErrorParams(error: unknown): Record<string, unknown> {
  if (!(error instanceof ApiError) || !error.details) {
    return { max: CUSTOMER_SELECTION_LIMIT.toLocaleString() };
  }
  const details = error.details;
  return {
    ...details,
    max: formatSelectionMax(details['max']),
  };
}

export function translateCustomerBulkError(
  transloco: TranslocoService,
  code: string | null | undefined,
  params?: Record<string, unknown>,
): string {
  const merged = {
    max: CUSTOMER_SELECTION_LIMIT.toLocaleString(),
    ...params,
  };
  if (code) {
    const moduleKey = `customerBulk.codes.${code}`;
    const moduleText = transloco.translate(moduleKey, merged);
    if (moduleText && moduleText !== moduleKey) return moduleText;

    const platformKey = `bulkJobs.codes.${code}`;
    const platformText = transloco.translate(platformKey, merged);
    if (platformText && platformText !== platformKey) return platformText;
  }

  const fallback = transloco.translate('customerBulk.codes.generic', merged);
  return fallback && fallback !== 'customerBulk.codes.generic' ? fallback : 'Something went wrong.';
}
