import {
  fakeCreateTax,
  fakeDeactivateTax,
  fakeGetTaxPermissions,
  fakeListCompanyOptions,
  fakeListTaxes,
  fakeUpdateTax,
} from './taxes.fake';
import {
  CompanyOption,
  CreateTaxBody,
  CorePage,
  Tax,
  TaxListQuery,
  TaxPermissions,
  UpdateTaxBody,
} from './taxes.model';

// GET /api/v1/tenant/taxes [taxes.tax.read] -> envelope { data: Tax[], meta }
export function listTaxes(query: TaxListQuery = {}): Promise<CorePage<Tax>> {
  return fakeListTaxes(query);
}

// POST /api/v1/tenant/taxes [taxes.tax.manage, checked per scope] (x-idempotency-key)
export function createTax(body: CreateTaxBody, key: string): Promise<Tax> {
  return fakeCreateTax(body, key);
}

// PATCH /api/v1/tenant/taxes/:id [taxes.tax.manage on the tax's company, or workspace-wide grant] (x-idempotency-key)
export function updateTax(id: string, body: UpdateTaxBody, key: string): Promise<Tax> {
  return fakeUpdateTax(id, body, key);
}

// DELETE /api/v1/tenant/taxes/:id [taxes.tax.manage on the tax's company, or workspace-wide grant] (x-idempotency-key)
export function deactivateTax(id: string, key: string): Promise<void> {
  return fakeDeactivateTax(id, key);
}

// no endpoint yet (plan D2): later GET /api/v1/tenant/organization/companies or a taxes company-options endpoint
export function listCompanyOptions(): Promise<CompanyOption[]> {
  return fakeListCompanyOptions();
}

// no endpoint yet (plan D2/D6): later from the session
export function getTaxPermissions(): Promise<TaxPermissions> {
  return fakeGetTaxPermissions();
}
