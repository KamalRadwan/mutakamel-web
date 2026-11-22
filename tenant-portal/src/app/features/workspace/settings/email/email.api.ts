import {
  fakeGetEmailConfig,
  fakeLiftSuppression,
  fakeLookupSuppression,
  fakePatchEmailConfig,
  fakeVerifyEmailDomain,
  fakeVerifySmtpConnection,
} from './email.fake';
import {
  EmailResult,
  PatchEmailConfigRequest,
  SuppressionLift,
  SuppressionLookup,
} from './email.model';

export function getEmailConfig(): Promise<EmailResult> {
  // GET /api/v1/core/tenant/email-config [workspace.email.read]
  return fakeGetEmailConfig();
}

export function patchEmailConfig(
  body: PatchEmailConfigRequest,
  revision: number,
  idempotencyKey: string,
): Promise<EmailResult> {
  // PATCH /api/v1/core/tenant/email-config [workspace.email.manage, tenant-wide] (If-Match "<n>", x-idempotency-key)
  return fakePatchEmailConfig(body, revision, idempotencyKey);
}

export function verifyEmailDomain(
  revision: number,
  idempotencyKey: string,
): Promise<EmailResult> {
  // POST /api/v1/core/tenant/email-config/verify [workspace.email.manage, tenant-wide] (If-Match "<n>", x-idempotency-key)
  return fakeVerifyEmailDomain(revision, idempotencyKey);
}

export function verifySmtpConnection(idempotencyKey: string): Promise<{ verified: true }> {
  // POST /api/v1/core/tenant/email-config/verify-connection [workspace.email.manage, tenant-wide] (x-idempotency-key)
  return fakeVerifySmtpConnection(idempotencyKey);
}

export function lookupSuppression(address: string): Promise<SuppressionLookup> {
  // POST /api/v1/core/tenant/email-suppressions/lookup [workspace.email.manage, tenant-wide]
  return fakeLookupSuppression(address);
}

export function liftSuppression(
  address: string,
  idempotencyKey: string,
): Promise<SuppressionLift> {
  // POST /api/v1/core/tenant/email-suppressions/lift [workspace.email.manage, tenant-wide] (x-idempotency-key)
  return fakeLiftSuppression(address, idempotencyKey);
}
