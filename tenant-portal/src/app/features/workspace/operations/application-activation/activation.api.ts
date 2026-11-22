import {
  fakeGetAddonCommand,
  fakeGetBranchAddon,
  fakeGetCompanyAddon,
  fakeGetCompanyApplication,
  fakeListCompanyActivations,
  fakeSetBranchOverride,
  fakeSetCompanyAddon,
  fakeSetCompanyApplication,
} from './activation.fake';
import {
  ActivationListItem,
  ActivationListResponse,
  ActivationSingleton,
  ActivationWriteReceipt,
  AddonActivationResource,
  AddonCommandStatusResponse,
  ApplicationActivationResource,
  BranchOverrideResource,
  SetBranchOverrideBody,
  SetCompanyAddonBody,
  SetCompanyAddonResponse,
  SetCompanyApplicationBody,
} from './activation.model';

/*
 * Errors (core-app tenant/application-access): writes need `applications.activation.manage` (403
 * MISSING_REQUIRED_PERMISSIONS {permissions}), reads ANY read/manage ({anyPermissions}); no exact-scope authority
 * is 403 ACCESS_POLICY_BLOCKED; a bad path/body is 400 CORE_VALIDATION_FAILED without details; the gateway sends
 * GW.IDEM.MISSING / GW.IDEM.BAD_VALUE / GW.IDEM.IN_FLIGHT; a reused key with another request is 422
 * IDEMPOTENCY_BODY_MISMATCH; domain refusals are 409 (APPLICATION_ALLOWANCE_NOT_READY, *_REVISION_STALE).
 */

/**
 * GET /api/tenant/core/v1/companies/:companyId/application-activations?page&limit
 * Query: page (1..1000000), limit (1..100). No body; no org headers.
 */
export function listCompanyActivations(
  companyId: string,
  page = 1,
  limit = 100,
): Promise<ActivationListResponse> {
  return fakeListCompanyActivations(companyId, page, limit);
}

/**
 * Fetches all pages (limit 100) of
 * GET /api/tenant/core/v1/companies/:companyId/application-activations?page&limit
 */
export async function listAllCompanyActivations(companyId: string): Promise<ActivationListItem[]> {
  const all: ActivationListItem[] = [];
  let page = 1;
  while (true) {
    const res = await listCompanyActivations(companyId, page, 100);
    all.push(...res.data);
    if (!res.meta.hasNext || res.data.length === 0 || page >= res.meta.totalPages) {
      break;
    }
    page += 1;
  }
  return all;
}

/**
 * GET /api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey
 * No body; no org headers.
 */
export function getCompanyApplication(
  companyId: string,
  appKey: string,
): Promise<ActivationSingleton<ApplicationActivationResource>> {
  return fakeGetCompanyApplication(companyId, appKey);
}

/**
 * GET /api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey
 * No body; no org headers.
 */
export function getCompanyAddon(
  companyId: string,
  appKey: string,
  addonKey: string,
): Promise<ActivationSingleton<AddonActivationResource>> {
  return fakeGetCompanyAddon(companyId, appKey, addonKey);
}

/**
 * GET /api/tenant/core/v1/branches/:branchId/application-activations/:applicationKey/addons/:addonKey
 * No body; no org headers.
 */
export function getBranchAddon(
  branchId: string,
  appKey: string,
  addonKey: string,
): Promise<ActivationSingleton<BranchOverrideResource>> {
  return fakeGetBranchAddon(branchId, appKey, addonKey);
}

/**
 * PATCH /api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey
 * Headers: x-idempotency-key (UUIDv7). No If-Match; uses expectedActivationRevision in body.
 */
export function setCompanyApplication(
  companyId: string,
  appKey: string,
  body: SetCompanyApplicationBody,
  key: string,
): Promise<ActivationWriteReceipt> {
  return fakeSetCompanyApplication(companyId, appKey, body, key);
}

/**
 * PATCH /api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey
 * Headers: x-idempotency-key (UUIDv7). No If-Match; uses expectedActivationRevision in body.
 * Returns 200 ActivationWriteReceipt or 202 AddonActivationPendingCommand (commandId = the idempotency key).
 * Retrying the same key while pending returns the current status; after REJECTED it is 409 ADDON_REVISION_STALE.
 */
export function setCompanyAddon(
  companyId: string,
  appKey: string,
  addonKey: string,
  body: SetCompanyAddonBody,
  key: string,
): Promise<SetCompanyAddonResponse> {
  return fakeSetCompanyAddon(companyId, appKey, addonKey, body, key);
}

/**
 * GET /api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey/activation-commands/:commandId
 * Headers: Cache-Control: private, no-store (response). Only the original command actor may poll: an unknown
 * command, another actor or another target is 403 ACCESS_POLICY_BLOCKED, never 404.
 */
export function getAddonCommand(
  companyId: string,
  appKey: string,
  addonKey: string,
  commandId: string,
): Promise<AddonCommandStatusResponse> {
  return fakeGetAddonCommand(companyId, appKey, addonKey, commandId);
}

/**
 * PATCH /api/tenant/core/v1/branches/:branchId/application-activations/:applicationKey/addons/:addonKey
 * Headers: x-idempotency-key (UUIDv7). No If-Match; uses expectedOverrideRevision in body.
 */
export function setBranchOverride(
  branchId: string,
  appKey: string,
  addonKey: string,
  body: SetBranchOverrideBody,
  key: string,
): Promise<ActivationWriteReceipt> {
  return fakeSetBranchOverride(branchId, appKey, addonKey, body, key);
}
