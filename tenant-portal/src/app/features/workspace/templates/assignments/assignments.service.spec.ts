import { describe, expect, it } from 'vitest';
import {
  ASSIGNMENT_SELECTOR_CATALOGUE,
  SUPPORTED_ASSIGNMENT_SELECTORS,
  assignmentSelectorDropdownOptions,
  isAssignmentScopeAllowed,
  isProductionAssignableDocument,
} from './assignments.service';

describe('assignments.service owner runtime selectors', () => {
  it('enables the seven backend production tuples and disables invoice, contract and letter', () => {
    expect(SUPPORTED_ASSIGNMENT_SELECTORS.map((s) => s.adapterKey).sort()).toEqual([
      'CRM_CUSTOMER_OUTBOUND_EMAIL_V1',
      'CRM_LEAD_OUTBOUND_EMAIL_V1',
      'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1',
      'TRADE_PURCHASE_ORDER_PRINT_V1',
      'TRADE_PURCHASE_QUOTATION_PRINT_V1',
      'TRADE_QUOTATION_PRINT_V1',
      'TRADE_SALES_ORDER_PRINT_V1',
    ]);
    const disabled = ASSIGNMENT_SELECTOR_CATALOGUE.filter((s) => !s.productionAssignmentEnabled);
    expect(disabled.map((s) => s.documentType).sort()).toEqual(['CONTRACT', 'INVOICE', 'LETTER']);
    expect(disabled.every((s) => s.productionDisabledReason === 'OWNER_RUNTIME_UNAVAILABLE')).toBe(true);
    expect(isProductionAssignableDocument('SALES_ORDER')).toBe(true);
    expect(isProductionAssignableDocument('INVOICE')).toBe(false);
  });

  it('shows disabled selectors with the reason as a tooltip', () => {
    const options = assignmentSelectorDropdownOptions((key) => key);
    expect(options.find((o) => o.value === 'TRADE_INVOICE_PRINT_V1')).toEqual(
      expect.objectContaining({ disabled: true, title: 'assignments.disabledReasons.OWNER_RUNTIME_UNAVAILABLE' }),
    );
    expect(options.find((o) => o.value === 'TRADE_SALES_ORDER_PRINT_V1')?.disabled).toBeUndefined();
  });
});

describe('assignments.service isAssignmentScopeAllowed', () => {
  const tenantOwner = { type: 'TENANT' } as const;
  const companyOwner = { type: 'COMPANY', companyId: 'c1' } as const;

  it('lets a Tenant-owned template target every scope', () => {
    expect(isAssignmentScopeAllowed(tenantOwner, { type: 'TENANT' })).toBe(true);
    expect(isAssignmentScopeAllowed(tenantOwner, { type: 'COMPANY', companyId: 'c2' })).toBe(true);
    expect(isAssignmentScopeAllowed(tenantOwner, { type: 'BRANCH', companyId: 'c2', branchId: 'b1' })).toBe(true);
  });

  it('lets a Company-owned template target only that Company and its Branches', () => {
    expect(isAssignmentScopeAllowed(companyOwner, { type: 'COMPANY', companyId: 'c1' })).toBe(true);
    expect(isAssignmentScopeAllowed(companyOwner, { type: 'BRANCH', companyId: 'c1', branchId: 'b1' })).toBe(true);
  });

  it('rejects Tenant and other-Company targets for a Company-owned template', () => {
    expect(isAssignmentScopeAllowed(companyOwner, { type: 'TENANT' })).toBe(false);
    expect(isAssignmentScopeAllowed(companyOwner, { type: 'COMPANY', companyId: 'c2' })).toBe(false);
    expect(isAssignmentScopeAllowed(companyOwner, { type: 'BRANCH', companyId: 'c2', branchId: 'b9' })).toBe(false);
  });
});
