import type {
  TenantDestroyPhase,
  TenantDestroyView,
  TenantStatus,
  TenantView,
} from "../types";

export const TENANT_ID = "019ff251-02e5-71fc-a7e9-05495cb3c6a8";
export const OTHER_TENANT_ID = "019ff252-02e5-71fc-a7e9-05495cb3c6a8";
export const STORAGE_ID = "019ff251-2222-7222-8222-222222222222";
export const DATABASE_ID = "019ff251-3333-7333-8333-333333333333";
export const PLATFORM_FQDN_ID = "019ff251-4444-7444-8444-444444444444";
export const CUSTOM_FQDN_ID = "019ff251-5555-7555-8555-555555555555";
export const OPERATION_ID = "019ff251-6666-7666-8666-666666666666";
export const DESTROY_OPERATION_ID = "019ff251-8888-7888-8888-888888888888";
export const UPDATED_AT = "2026-08-11T19:33:49.000Z";
export const NEXT_UPDATED_AT = "2026-08-11T19:34:49.000Z";

/**
 * A destruction projection exactly as Core answers it for `phase`, honouring
 * the table's pairings: completion only on SUCCEEDED, abandonment only on
 * ABANDONED, a next attempt only while Worker advances, block evidence on
 * BLOCKED (a stop that blocked before the drop), and the provisioning
 * operation it waits on while stopping.
 */
export function tenantDestroyFixture(
  phase: TenantDestroyPhase = "STOPPING_PROVISIONING",
  overrides: Partial<TenantDestroyView> = {},
): TenantDestroyView {
  const advancing =
    phase === "STOPPING_PROVISIONING" ||
    phase === "DROPPING_DATABASE" ||
    phase === "FINALIZING";
  return {
    operationId: DESTROY_OPERATION_ID,
    tenantId: TENANT_ID,
    phase,
    requestedAt: UPDATED_AT,
    updatedAt: NEXT_UPDATED_AT,
    completedAt: phase === "SUCCEEDED" ? NEXT_UPDATED_AT : null,
    lastErrorCode: null,
    attempts: advancing || phase === "BLOCKED" ? 3 : 0,
    nextAttemptAt: advancing ? NEXT_UPDATED_AT : null,
    blockedAt: phase === "BLOCKED" ? NEXT_UPDATED_AT : null,
    blockedReason:
      phase === "BLOCKED" ? "TENANT_DESTROY_OPEN_PROVISIONING_OPERATION" : null,
    blockedPhase: phase === "BLOCKED" ? "STOPPING_PROVISIONING" : null,
    blockingOperationId:
      phase === "STOPPING_PROVISIONING" || phase === "BLOCKED"
        ? OPERATION_ID
        : null,
    abandonedAt: phase === "ABANDONED" ? NEXT_UPDATED_AT : null,
    ...overrides,
  };
}

/**
 * A request that halted after Core authorized the drop, as Core reports it:
 * BLOCKED with the phase it halted in, Worker's code as the reason, its spent
 * attempt budget, and no provisioning operation (cleared once the drop was
 * authorized).
 */
export function haltedTenantDestroyFixture(
  blockedPhase: "DROPPING_DATABASE" | "FINALIZING" = "DROPPING_DATABASE",
  overrides: Partial<TenantDestroyView> = {},
): TenantDestroyView {
  return tenantDestroyFixture("BLOCKED", {
    blockedPhase,
    blockedReason: "WORKER.TENANT_DESTROY.DATABASE.CONNECTION_REFUSED",
    lastErrorCode: "WORKER.TENANT_DESTROY.DATABASE.CONNECTION_REFUSED",
    attempts: 20,
    blockingOperationId: null,
    ...overrides,
  });
}

export function tenantFixture(
  status: TenantStatus = "ACTIVE",
  overrides: Partial<TenantView> = {},
): TenantView {
  return {
    id: TENANT_ID,
    name: "acme",
    companyName: "Acme LLC",
    countryName: "Egypt",
    countryIsoCode: "EG",
    industry: "Technology",
    timezone: "Africa/Cairo",
    phoneCountryCode: "+20",
    phone: "01000000000",
    address: {
      city: "Cairo",
      state: "Cairo",
      street1: "Tahrir Street",
    },
    taxNumber: "TAX-1",
    commercialRegistrationNumber: "CR-1",
    ownerEmail: "owner@example.com",
    ownerFirstName: "Ada",
    ownerLastName: "Lovelace",
    ownerPhoneCountryCode: "+20",
    ownerPhone: "01000000000",
    ownerJobTitle: "Founder",
    ownerLanguage: "en",
    ownerUsername: "ada.lovelace",
    ownerAccountLinked: true,
    databaseName: "tenant_acme",
    status,
    createdAt: "2026-08-11T19:30:00.000Z",
    updatedAt: UPDATED_AT,
    fqdns: [
      {
        id: PLATFORM_FQDN_ID,
        fqdn: "acme.mutakamel.ai",
        isPrimary: true,
        validationStatus: "VALID",
        verifiedAt: "2026-08-11T19:30:00.000Z",
        createdAt: "2026-08-11T19:30:00.000Z",
        updatedAt: "2026-08-11T19:30:00.000Z",
      },
    ],
    subscription: {
      status: "TRIAL",
      effectiveAllowedUsers: 10,
      billingCycle: null,
      currencyCode: null,
      totalPrice: null,
      startedAt: "2026-08-11T19:30:00.000Z",
      currentPeriodStart: null,
      currentPeriodEnd: "2026-08-25T19:30:00.000Z",
      trialDays: 14,
      trialStartedAt: "2026-08-11T19:30:00.000Z",
      trialEndsAt: "2026-08-25T19:30:00.000Z",
      activationScheduledAt: null,
      activatedAt: null,
      cancelAt: null,
    },
    databaseServer: {
      id: DATABASE_ID,
      name: "Postgres Cairo",
      driver: "postgres",
      countryName: "Egypt",
      countryIsoCode: "EG",
      maxTenants: 100,
      currentTenants: 4,
      status: "ACTIVE",
    },
    storageServerId: STORAGE_ID,
    storageServer: {
      id: STORAGE_ID,
      code: "garage-cairo-1",
      name: "Garage Cairo",
      region: "af-cairo-1",
      status: "ACTIVE",
    },
    ...overrides,
  };
}

export function tenantPayload(
  status: TenantStatus = "ACTIVE",
): Record<string, unknown> {
  const tenant = tenantFixture(status);
  return {
    ...tenant,
    storageServer: tenant.storageServer
      ? {
          ...tenant.storageServer,
          bucketName: "tenant-private-bucket",
          endpoint: "https://secret-internal.example",
          accessKeyId: "must-never-survive-the-reader",
        }
      : undefined,
  };
}

export function customFqdnFixture() {
  return {
    id: CUSTOM_FQDN_ID,
    fqdn: "portal.example.com",
    isPrimary: false,
    validationStatus: "VALID" as const,
    verifiedAt: "2026-08-11T19:31:00.000Z",
    createdAt: "2026-08-11T19:31:00.000Z",
    updatedAt: "2026-08-11T19:31:00.000Z",
  };
}
