import { ApiError } from '../../../../core/api/api-errors';
import { getLead, listLeadCustomFields } from '../leads.api';
import { crmQueries } from '../../shared/crm-http';
import type { LeadCustomField, LeadDetail } from '../leads.model';

/** NONE: definition catalogue, no scope headers. A denied catalogue disables only its controls. */
export async function readLeadFieldDefinitions(): Promise<LeadCustomField[] | null> {
  try {
    return await listLeadCustomFields();
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return null;
    throw error;
  }
}

/** NONE: compatibility for the modal; use its loaded detail, never the separate values route. */
export async function readLeadFieldValues(branchId: string, ownerId: string): Promise<Record<string, unknown> | null> {
  const detail = crmQueries().getQueryData<LeadDetail>(['crm-leads', 'detail', branchId, ownerId])
    ?? await getLead(ownerId);
  return detail.customFields;
}
