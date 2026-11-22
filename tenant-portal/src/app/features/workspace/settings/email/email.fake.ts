import { ApiError } from '../../../../core/api/api-errors';
import { CORE_VALIDATION_FAILED, coreValidationDetails } from '../core-response.model';
import { fakeDelay } from '../../../../core/fake/fake-utils';
import {
  EMAIL_QUOTA_MAX,
  EmailResult,
  PatchEmailConfigRequest,
  SMTP_ALLOWED_PORTS,
  SuppressionLift,
  SuppressionLookup,
  TenantEmailConfig,
  UUID_V7_PATTERN,
  extractEmailDomain,
  isValidBareEmail,
  isValidDkimSelector,
  isValidDomain,
  isValidSmtpHost,
} from './email.model';

export const FAKE_EMAIL_FAIL_NEXT: { code: string | null; status: number } = {
  code: null,
  status: 0,
};

interface SuppressionEntry {
  reasonCode: 'HARD_BOUNCE' | 'COMPLAINT';
  firstOccurredAt: string;
  lastOccurredAt: string;
}

interface EmailFakeStore {
  config: TenantEmailConfig;
  suppressions: Map<string, SuppressionEntry>;
  idempotency: Map<string, { fingerprint: string; result: unknown }>;
}

const DEFAULT_FAIL_STATUS: Readonly<Record<string, number>> = {
  TENANT_EMAIL_CONFIG_NOT_READY: 503,
  TENANT_EMAIL_CONFIG_DEPENDENCY_UNAVAILABLE: 503,
  ACCESS_POLICY_BLOCKED: 403,
  TENANT_WIDE_PERMISSION_REQUIRED: 403,
  TOO_MANY_REQUESTS: 429,
};

function createSeedStore(): EmailFakeStore {
  return {
    config: {
      revision: 7,
      fromAddress: 'noreply@acme.example',
      fromName: 'Acme Support',
      replyTo: null,
      senderDomain: 'acme.example',
      providerDriver: 'smtp',
      credentialsMode: 'TENANT_ENCRYPTED_SMTP',
      providerCredentialsConfigured: true,
      providerCredentialsVersion: null,
      providerCredentialsRefFingerprint: null,
      smtpHost: 'smtp.acme.example',
      smtpPort: 587,
      smtpSecure: true,
      smtpProtocol: 'smtp',
      smtpUsername: 'mailer@acme.example',
      smtpPasswordConfigured: true,
      feedbackProfile: 'CRM_FEEDBACK_V1',
      dkimSelector: 'mt1',
      dkimVerified: false,
      verifiedAt: null,
      planDailyQuota: 10_000,
      planRateLimitPerMin: 100,
      planQuotaRevision: 1,
      dailyQuota: null,
      rateLimitPerMin: null,
      effectiveDailyQuota: 10_000,
      effectiveRateLimitPerMin: 100,
      status: 'SUSPENDED',
      updatedAt: '2026-11-18T09:30:00.000Z',
    },
    suppressions: new Map<string, SuppressionEntry>([
      [
        'blocked@example.com',
        {
          reasonCode: 'HARD_BOUNCE',
          firstOccurredAt: '2026-11-02T08:15:00.000Z',
          lastOccurredAt: '2026-11-19T14:42:00.000Z',
        },
      ],
      [
        'spam@example.com',
        {
          reasonCode: 'COMPLAINT',
          firstOccurredAt: '2026-11-10T11:20:00.000Z',
          lastOccurredAt: '2026-11-15T16:05:00.000Z',
        },
      ],
    ]),
    idempotency: new Map<string, { fingerprint: string; result: unknown }>(),
  };
}

let store: EmailFakeStore = createSeedStore();

export function FAKE_EMAIL_BUMP_REVISION(): number {
  store.config.revision += 1;
  store.config.updatedAt = new Date().toISOString();
  return store.config.revision;
}

export function resetEmailFake(): void {
  store = createSeedStore();
  FAKE_EMAIL_FAIL_NEXT.code = null;
  FAKE_EMAIL_FAIL_NEXT.status = 0;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function consumeFailNext(): void {
  const { code, status } = FAKE_EMAIL_FAIL_NEXT;
  if (!code && status === 0) return;
  FAKE_EMAIL_FAIL_NEXT.code = null;
  FAKE_EMAIL_FAIL_NEXT.status = 0;
  const resolvedStatus =
    status !== 0 ? status : code === 'NETWORK' ? 0 : (DEFAULT_FAIL_STATUS[code ?? ''] ?? 500);
  throw new ApiError(resolvedStatus, code ?? 'INTERNAL_ERROR');
}

/**
 * Every email write route is WRITE_SENSITIVE at the gateway (core.route-contracts.ts,
 * core-email-suppression.route-contracts.ts), so the gateway answers key problems before Core:
 * 400 GW.IDEM.MISSING / GW.IDEM.BAD_VALUE, and 422 GW.IDEM.MISMATCH for a key reused with another request.
 */
function validateIdempotencyKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  if (!UUID_V7_PATTERN.test(trimmed)) {
    throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  }
  return trimmed;
}

/** `request` is everything the gateway fingerprints: the body plus the If-Match revision. */
function runIdempotent<T>(op: string, key: string, request: unknown, run: () => T): T {
  const validKey = validateIdempotencyKey(key);
  const fingerprint = JSON.stringify({ op, request }) ?? '';
  const existing = store.idempotency.get(validKey);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    return clone(existing.result as T);
  }
  const result = run();
  store.idempotency.set(validKey, { fingerprint, result: clone(result) });
  return clone(result);
}

/** Core's ValidationPipe (PatchTenantEmailConfigDto, EmailSuppressionAddressDto): 400 keyed by field. */
function invalidField(field: string): ApiError {
  return new ApiError(400, CORE_VALIDATION_FAILED, coreValidationDetails({ [field]: 'invalid' }));
}

function assertRevision(revision: number | null | undefined): void {
  if (revision === null || revision === undefined || !Number.isInteger(revision) || revision < 1) {
    throw new ApiError(428, 'TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED');
  }
  if (revision !== store.config.revision) {
    throw new ApiError(409, 'TENANT_EMAIL_CONFIG_STALE_REVISION');
  }
}

function toResult(config: TenantEmailConfig): EmailResult {
  return {
    config: clone(config),
    revision: config.revision,
  };
}

function configsEqual(a: TenantEmailConfig, b: TenantEmailConfig): boolean {
  return (
    a.fromAddress === b.fromAddress &&
    a.fromName === b.fromName &&
    a.replyTo === b.replyTo &&
    a.senderDomain === b.senderDomain &&
    a.providerDriver === b.providerDriver &&
    a.credentialsMode === b.credentialsMode &&
    a.providerCredentialsConfigured === b.providerCredentialsConfigured &&
    a.smtpHost === b.smtpHost &&
    a.smtpPort === b.smtpPort &&
    a.smtpSecure === b.smtpSecure &&
    a.smtpProtocol === b.smtpProtocol &&
    a.smtpUsername === b.smtpUsername &&
    a.smtpPasswordConfigured === b.smtpPasswordConfigured &&
    a.dkimSelector === b.dkimSelector &&
    a.dailyQuota === b.dailyQuota &&
    a.rateLimitPerMin === b.rateLimitPerMin &&
    a.status === b.status
  );
}

function hasCompleteSmtpBlock(config: TenantEmailConfig): boolean {
  return (
    Boolean(config.smtpHost) &&
    config.smtpPort !== null &&
    config.smtpSecure !== null &&
    config.smtpProtocol !== null &&
    Boolean(config.smtpUsername) &&
    config.smtpPasswordConfigured
  );
}

export async function fakeGetEmailConfig(): Promise<EmailResult> {
  await fakeDelay();
  consumeFailNext();
  return toResult(store.config);
}

export async function fakePatchEmailConfig(
  body: PatchEmailConfigRequest,
  revision: number,
  idempotencyKey: string,
): Promise<EmailResult> {
  await fakeDelay();
  consumeFailNext();

  return runIdempotent('patchEmailConfig', idempotencyKey, { body, revision }, () => {
    assertRevision(revision);

    const record = body as Record<string, unknown>;
    const suppliedKeys = Object.keys(record).filter((k) => record[k] !== undefined);
    if (suppliedKeys.length === 0) {
      throw new ApiError(400, 'TENANT_EMAIL_CONFIG_EMPTY_PATCH');
    }

    const current = store.config;

    // Status-only patch acts as a kill switch / toggle and skips unrelated field validation.
    if (suppliedKeys.length === 1 && suppliedKeys[0] === 'status') {
      if (body.status !== 'ACTIVE' && body.status !== 'SUSPENDED') {
        throw invalidField('status');
      }
      if (body.status === 'ACTIVE' && !current.dkimVerified) {
        throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
      }
      if (body.status === current.status) {
        throw new ApiError(422, 'TENANT_EMAIL_CONFIG_NO_CHANGES');
      }
      current.status = body.status;
      current.revision += 1;
      current.updatedAt = new Date().toISOString();
      return toResult(current);
    }

    const next: TenantEmailConfig = clone(current);

    if (body.fromName !== undefined) {
      if (body.fromName.length < 1 || body.fromName.length > 200) {
        throw invalidField('fromName');
      }
      const name = body.fromName.trim();
      if (!name) {
        throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
      }
      next.fromName = name;
    }

    if (body.fromAddress !== undefined) {
      const addr = body.fromAddress.trim();
      if (!isValidBareEmail(addr)) {
        throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
      }
      next.fromAddress = addr;
    }

    if (body.replyTo !== undefined) {
      if (body.replyTo === null) {
        next.replyTo = null;
      } else {
        const reply = body.replyTo.trim();
        if (!reply) {
          next.replyTo = null;
        } else if (!isValidBareEmail(reply)) {
          throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
        } else {
          next.replyTo = reply;
        }
      }
    }

    if (body.senderDomain !== undefined) {
      const domain = body.senderDomain.trim().toLowerCase();
      if (!isValidDomain(domain)) {
        throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
      }
      next.senderDomain = domain;
    }

    const fromDomain = extractEmailDomain(next.fromAddress);
    if (!fromDomain || fromDomain !== next.senderDomain) {
      throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
    }

    if (body.providerDriver !== undefined) {
      if (
        body.providerDriver !== 'smtp' &&
        body.providerDriver !== 'ses' &&
        body.providerDriver !== 'sendgrid' &&
        body.providerDriver !== 'platform-shared'
      ) {
        throw invalidField('providerDriver');
      }
      next.providerDriver = body.providerDriver;
    }

    const smtpKeysInBody = suppliedKeys.some((k) => k.startsWith('smtp'));
    if (next.providerDriver !== 'smtp' && smtpKeysInBody) {
      throw new ApiError(422, 'TENANT_SMTP_SETTINGS_INVALID');
    }

    let passwordProvided = false;
    if (next.providerDriver === 'smtp') {
      if (body.smtpHost !== undefined) {
        const host = body.smtpHost.trim().toLowerCase();
        if (!isValidSmtpHost(host)) {
          throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
        }
        next.smtpHost = host;
      }
      if (body.smtpPort !== undefined) {
        if (!SMTP_ALLOWED_PORTS.includes(body.smtpPort)) {
          throw invalidField('smtpPort');
        }
        next.smtpPort = body.smtpPort;
      }
      if (body.smtpProtocol !== undefined) {
        if (body.smtpProtocol !== 'smtp' && body.smtpProtocol !== 'smtps') {
          throw invalidField('smtpProtocol');
        }
        next.smtpProtocol = body.smtpProtocol;
      }
      if (body.smtpSecure !== undefined) {
        if (typeof body.smtpSecure !== 'boolean') {
          throw invalidField('smtpSecure');
        }
        next.smtpSecure = body.smtpSecure;
      }
      if (body.smtpUsername !== undefined) {
        if (body.smtpUsername.length > 320) {
          throw invalidField('smtpUsername');
        }
        const username = body.smtpUsername.trim();
        if (!username) {
          throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
        }
        next.smtpUsername = username;
      }
      if (body.smtpPassword !== undefined) {
        if (body.smtpPassword.length < 1 || body.smtpPassword.length > 1024) {
          throw invalidField('smtpPassword');
        }
        next.smtpPasswordConfigured = true;
        passwordProvided = true;
      }

      if (next.smtpProtocol === 'smtps' && next.smtpSecure !== true) {
        throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
      }
      if (!hasCompleteSmtpBlock(next)) {
        throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
      }

      next.credentialsMode = 'TENANT_ENCRYPTED_SMTP';
      next.providerCredentialsConfigured = true;
    } else {
      next.smtpHost = null;
      next.smtpPort = null;
      next.smtpSecure = null;
      next.smtpProtocol = null;
      next.smtpUsername = null;
      next.smtpPasswordConfigured = false;
      next.credentialsMode =
        next.providerDriver === 'platform-shared' ? 'PLATFORM_SHARED' : 'TENANT_VERSIONED_REF';
      next.providerCredentialsConfigured = true;
    }

    if (body.dkimSelector !== undefined) {
      if (body.dkimSelector === null) {
        next.dkimSelector = null;
      } else {
        const selector = body.dkimSelector.trim().toLowerCase();
        if (!selector) {
          next.dkimSelector = null;
        } else if (!isValidDkimSelector(selector)) {
          throw invalidField('dkimSelector');
        } else {
          next.dkimSelector = selector;
        }
      }
    }

    if (body.dailyQuota !== undefined) {
      if (body.dailyQuota === null) {
        next.dailyQuota = null;
      } else {
        if (
          !Number.isInteger(body.dailyQuota) ||
          body.dailyQuota < 1 ||
          body.dailyQuota > EMAIL_QUOTA_MAX.daily
        ) {
          throw invalidField('dailyQuota');
        }
        if (body.dailyQuota > next.planDailyQuota) {
          throw new ApiError(422, 'TENANT_EMAIL_CONFIG_QUOTA_EXCEEDS_PLAN');
        }
        next.dailyQuota = body.dailyQuota;
      }
    }

    if (body.rateLimitPerMin !== undefined) {
      if (body.rateLimitPerMin === null) {
        next.rateLimitPerMin = null;
      } else {
        if (
          !Number.isInteger(body.rateLimitPerMin) ||
          body.rateLimitPerMin < 1 ||
          body.rateLimitPerMin > EMAIL_QUOTA_MAX.perMinute
        ) {
          throw invalidField('rateLimitPerMin');
        }
        if (body.rateLimitPerMin > next.planRateLimitPerMin) {
          throw new ApiError(422, 'TENANT_EMAIL_CONFIG_QUOTA_EXCEEDS_PLAN');
        }
        next.rateLimitPerMin = body.rateLimitPerMin;
      }
    }

    const tupleChanged =
      next.providerDriver !== current.providerDriver ||
      next.fromAddress !== current.fromAddress ||
      next.senderDomain !== current.senderDomain ||
      next.dkimSelector !== current.dkimSelector;

    if (tupleChanged) {
      next.dkimVerified = false;
      next.verifiedAt = null;
      next.status = 'SUSPENDED';
    }

    if (body.status !== undefined) {
      if (body.status !== 'ACTIVE' && body.status !== 'SUSPENDED') {
        throw invalidField('status');
      }
      if (body.status === 'ACTIVE' && !next.dkimVerified) {
        throw new ApiError(422, 'TENANT_EMAIL_CONFIG_INVALID');
      }
      next.status = body.status;
    }

    next.effectiveDailyQuota = Math.min(next.dailyQuota ?? next.planDailyQuota, next.planDailyQuota);
    next.effectiveRateLimitPerMin = Math.min(
      next.rateLimitPerMin ?? next.planRateLimitPerMin,
      next.planRateLimitPerMin,
    );

    if (!passwordProvided && configsEqual(next, current)) {
      throw new ApiError(422, 'TENANT_EMAIL_CONFIG_NO_CHANGES');
    }

    next.revision = current.revision + 1;
    next.updatedAt = new Date().toISOString();
    store.config = next;
    return toResult(next);
  });
}

export async function fakeVerifyEmailDomain(
  revision: number,
  idempotencyKey: string,
): Promise<EmailResult> {
  await fakeDelay();
  consumeFailNext();

  return runIdempotent('verifyEmailDomain', idempotencyKey, { revision }, () => {
    assertRevision(revision);
    const current = store.config;

    if (!current.dkimSelector || current.senderDomain === 'fail.example') {
      throw new ApiError(422, 'TENANT_EMAIL_CONFIG_VERIFICATION_FAILED');
    }
    if (current.dkimSelector === 'unregistered') {
      throw new ApiError(422, 'TENANT_EMAIL_CONFIG_DKIM_PROOF_NOT_REGISTERED');
    }

    current.dkimVerified = true;
    current.verifiedAt = new Date().toISOString();
    current.revision += 1;
    current.updatedAt = current.verifiedAt;
    return toResult(current);
  });
}

export async function fakeVerifySmtpConnection(idempotencyKey: string): Promise<{ verified: true }> {
  await fakeDelay();
  consumeFailNext();

  return runIdempotent('verifySmtpConnection', idempotencyKey, {}, () => {
    const current = store.config;
    if (current.providerDriver !== 'smtp' || !hasCompleteSmtpBlock(current)) {
      throw new ApiError(422, 'TENANT_SMTP_CONNECTION_VERIFICATION_UNAVAILABLE');
    }
    if (current.smtpHost === 'down.example') {
      throw new ApiError(422, 'TENANT_SMTP_CONNECTION_FAILED');
    }
    return { verified: true as const };
  });
}

export async function fakeLookupSuppression(address: string): Promise<SuppressionLookup> {
  await fakeDelay();
  consumeFailNext();

  const normalized = address.trim().toLowerCase();
  if (!isValidBareEmail(normalized)) {
    throw invalidField('address');
  }

  const entry = store.suppressions.get(normalized);
  if (!entry) {
    return { suppressed: false };
  }
  return {
    suppressed: true,
    reasonCode: entry.reasonCode,
    firstOccurredAt: entry.firstOccurredAt,
    lastOccurredAt: entry.lastOccurredAt,
  };
}

export async function fakeLiftSuppression(
  address: string,
  idempotencyKey: string,
): Promise<SuppressionLift> {
  await fakeDelay();
  consumeFailNext();

  return runIdempotent('liftSuppression', idempotencyKey, { address }, () => {
    const normalized = address.trim().toLowerCase();
    if (!isValidBareEmail(normalized)) {
      throw invalidField('address');
    }
    const lifted = store.suppressions.delete(normalized);
    return { suppressed: false as const, lifted };
  });
}
