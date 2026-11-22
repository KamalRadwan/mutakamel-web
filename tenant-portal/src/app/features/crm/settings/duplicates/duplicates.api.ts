import { fakeGetPolicy, fakePutBranch, fakePutCompany, fakePutDefaults } from './duplicates.fake';
import {
  BranchPatch,
  CompanyPatch,
  DefaultsPatch,
  PolicyTree,
  PolicyWriteResult,
} from './duplicates.model';

/** GET /api/tenant/crm/v1/settings/duplicate-policy */
export function getPolicy(): Promise<PolicyTree> {
  return fakeGetPolicy();
}

/** PUT /api/tenant/crm/v1/settings/duplicate-policy/defaults */
export function putDefaults(
  patch: DefaultsPatch,
  expectedRevision: number,
  confirmResets = false,
): Promise<PolicyWriteResult> {
  return fakePutDefaults(patch, expectedRevision, confirmResets);
}

/** PUT /api/tenant/crm/v1/settings/duplicate-policy/companies/:companyId */
export function putCompany(
  companyId: string,
  patch: CompanyPatch,
  expectedRevision: number,
  confirmResets = false,
): Promise<PolicyWriteResult> {
  return fakePutCompany(companyId, patch, expectedRevision, confirmResets);
}

/** PUT /api/tenant/crm/v1/settings/duplicate-policy/branches/:branchId */
export function putBranch(
  branchId: string,
  patch: BranchPatch,
  expectedRevision: number,
  confirmResets = false,
): Promise<PolicyWriteResult> {
  return fakePutBranch(branchId, patch, expectedRevision, confirmResets);
}
