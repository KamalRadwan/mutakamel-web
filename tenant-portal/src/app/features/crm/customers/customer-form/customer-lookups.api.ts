import { inject } from '@angular/core';
import { hasTenantWidePermission } from '../../../../core/auth/tenant-wide-permission';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { CoreHttp } from '../../../../core/api/core-http';
import { GeoCountry } from '../../../../core/geo/geo.model';
import { listActiveCoreCurrencies } from '../../../../shared/lookups/core-currencies';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { listCustomFields } from '../../settings/custom-fields/custom-fields.api';
import { listLeadSources } from '../../settings/lead-sources/lead-sources.api';
import { getCrmStaticData } from '../../settings/static-data/static-data.api';
import { listTags as readTags } from '../../settings/tags/tags.api';
import { listAssignableOwners } from '../../shared/lookups/assignable-owners';
import { branchOptions, sessionBranch } from '../../shared/lookups/session-branch';
import { runInCrm } from '../../shared/crm-runtime';
import { crmQueries } from '../../shared/crm-http';
import { CustomerCustomField, CustomerStatusOption, OwnerOption, SourceOption, TagSummary } from '../customers.model';

/** No scope headers: Core organization catalogue, restricted to the session branch. */
export async function listFormBranches() {
  const selected = runInCrm(() => sessionBranch());
  if (!selected) return [];
  const options = await runInCrm(() => branchOptions());
  return options.filter((branch) => branch.id === selected.branchId);
}

/** BRANCH_REQUIRED: XR-LK supplies both headers and handles runtime binding. */
export async function listFormOwners(branchId: string, action: 'create' | 'update'): Promise<OwnerOption[]> {
  const owners: OwnerOption[] = [];
  let cursor: string | undefined;
  do {
    const page = await runInCrm(() => listAssignableOwners(branchId, 'customer_profiles', action, { cursor }));
    owners.push(...page.items.map((owner) => ({ userId: owner.id, name: owner.displayName, avatarUrl: owner.avatarUrl })));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return owners;
}

/** No scope headers: CRM catalogue APIs own their TanStack queries. */
export function listFormSources(): Promise<SourceOption[]> { return listLeadSources(); }
export function listFormTags(): Promise<TagSummary[]> { return readTags(); }

export async function listFormCustomFields(): Promise<CustomerCustomField[]> {
  const fields = await listCustomFields();
  return fields.filter((field) => field.ownerType === 'CUSTOMER_PROFILE' && field.isActive).map((field) => ({
    ...field,
    options: field.options.filter((option) => option.isActive),
    requiredOnCreate: field.requirements.some((rule) => rule.operation === 'CREATE' && rule.isRequired && rule.entityScope === null),
    requiredOnUpdate: field.requirements.some((rule) => rule.operation === 'UPDATE' && rule.isRequired && rule.entityScope === null),
  }));
}

export async function listFormStatuses(): Promise<CustomerStatusOption[]> {
  return (await getCrmStaticData()).enumOptions['customerStatuses'] as CustomerStatusOption[] ?? [];
}

/** No scope headers: the Core currency catalogue is tenant-wide. */
export function listFormCurrencies() {
  return runInCrm(() => hasTenantWidePermission(inject(TenantScopeState).me(), 'currencies.currency.read')
    ? listActiveCoreCurrencies() : Promise.resolve([]));
}

export function canManageFormStatus(): boolean {
  return can('crm.customer_profiles.status.manage');
}

/** No scope headers: Core geography catalogue; an old Core image leaves only address unavailable. */
export function listFormCountries(): Promise<GeoCountry[]> {
  const http = runInCrm(() => inject(CoreHttp));
  return crmQueries().fetchQuery({
    queryKey: ['crm-customers', 'countries'],
    queryFn: async () => (await http.read<{ items: GeoCountry[] }>('/api/tenant/core/v1/geo/countries')).items,
  });
}
