import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export const TENANT_STATUSES = [
  "PROVISIONING",
  "PROVISIONING_FAILED",
  "ACTIVE",
  "SUSPENDED",
  "DELETED",
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const TENANT_FQDN_VALIDATION_STATUSES = [
  "PENDING",
  "VALID",
  "INVALID",
] as const;

type TenantFqdnValidationStatus =
  (typeof TENANT_FQDN_VALIDATION_STATUSES)[number];

export interface TenantAddress {
  city?: string;
  state?: string;
  district?: string;
  street1?: string;
  street2?: string;
  buildingNo?: string;
  postalCode?: string;
  landmark?: string;
  formattedAddress?: string;
}

export interface TenantFqdnView {
  id: string;
  fqdn: string;
  isPrimary: boolean;
  validationStatus: TenantFqdnValidationStatus;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscriptionSummary {
  status:
    | "TRIAL"
    | "PENDING_ACTIVATION"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELLED";
  effectiveAllowedUsers: number;
  billingCycle: string | null;
  currencyCode: string | null;
  totalPrice: string | null;
  startedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string;
  trialDays: number;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  activationScheduledAt: string | null;
  activatedAt: string | null;
  cancelAt: string | null;
}

export interface TenantDatabaseServerSummary {
  id: string;
  name: string;
  driver: "postgres";
  countryName?: string;
  countryIsoCode?: string;
  maxTenants?: number;
  currentTenants?: number;
  status: "DRAFT" | "ACTIVE" | "DRAINING" | "OFFLINE";
}

/**
 * The current Core projection contains bucketName as an implementation detail.
 * This browser model deliberately allowlists only registry display evidence.
 */
export interface TenantStorageServerSummary {
  id: string;
  code: string;
  name: string;
  region: string;
  status: "DRAFT" | "ACTIVE" | "OFFLINE";
}

export interface TenantView {
  id: string;
  name: string;
  companyName: string;
  countryName: string;
  countryIsoCode: string;
  industry: string | null;
  timezone: string | null;
  phoneCountryCode: string | null;
  phone: string | null;
  address: TenantAddress | null;
  taxNumber: string | null;
  commercialRegistrationNumber: string | null;
  ownerEmail: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerPhoneCountryCode: string | null;
  ownerPhone: string | null;
  ownerJobTitle: string | null;
  ownerLanguage: string | null;
  ownerUsername: string | null;
  ownerAccountLinked: boolean;
  databaseName: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  fqdns: TenantFqdnView[];
  subscription?: TenantSubscriptionSummary;
  databaseServer?: TenantDatabaseServerSummary;
  storageServerId: string;
  storageServer?: TenantStorageServerSummary;
}

export interface TenantProfileDraft {
  companyName: string;
  countryName: string;
  countryIsoCode: string;
  industry: string | null;
  timezone: string | null;
  phoneCountryCode: string | null;
  phone: string | null;
  address: TenantAddress | null;
  taxNumber: string | null;
  commercialRegistrationNumber: string | null;
}

export interface UpdateTenantProfileDto extends TenantProfileDraft {
  expectedUpdatedAt: string;
}

type FqdnPreflightReason =
  | "INVALID_FORMAT"
  | "TAKEN"
  | "DNS_NOT_FOUND"
  | "UNREACHABLE";

export interface FqdnAvailabilityResult {
  fqdn: string;
  valid: boolean;
  available: boolean;
  dnsResolved?: boolean;
  reachable?: boolean;
  reason?: FqdnPreflightReason;
  message: string;
}

export const TENANT_OPERATION_STATUSES = [
  "REQUESTED",
  "PLANNING",
  "QUEUED",
  "RUNNING",
  "WAITING_RETRY",
  "CANCEL_REQUESTED",
  "SUCCEEDED",
  "FAILED_RETRYABLE",
  "MANUAL_RECOVERY_REQUIRED",
  "CANCELLED",
] as const;

type TenantOperationStatus =
  (typeof TENANT_OPERATION_STATUSES)[number];

export const TENANT_OPERATION_TYPES = [
  "INITIAL_PROVISION",
  "RETRY",
  "UPDATE",
  "ADD_APPLICATION",
  "REPAIR",
  "DECOMMISSION",
] as const;

type TenantOperationType = (typeof TENANT_OPERATION_TYPES)[number];

export interface TenantProvisioningCommandResult {
  replayed: boolean;
  operation: {
    id: string;
    tenantId?: string;
    generation?: number;
    type: TenantOperationType;
    status: TenantOperationStatus;
    currentPhase?: string;
    updatedAt?: string;
  };
}

export type TenantResourceState =
  | "idle"
  | "loading"
  | "ready"
  | "forbidden"
  | "error"
  | "destroyed";

export type TenantMutationName =
  | "profile"
  | "suspend"
  | "activate"
  | "reprovision"
  | "cancel-provisioning"
  | "soft-delete"
  | "restore"
  | "destroy"
  | "abandon-destroy"
  | "resume-destroy";

export type TenantFqdnMutationName =
  | "preflight"
  | "add"
  | "remove"
  | "promote";

export interface TenantMutationState<Name extends string> {
  name: Name | null;
  error: NormalizedApiError | null;
}

export interface TenantCorePermissions {
  canRead: boolean;
  canUpdate: boolean;
  canSuspendOrActivate: boolean;
  canReprovisionOrCancel: boolean;
  canSoftDelete: boolean;
  canRestore: boolean;
  canDestroy: boolean;
  canValidateFqdn: boolean;
  canManageFqdns: boolean;
}

/**
 * Worker advances STOPPING_PROVISIONING → DROPPING_DATABASE → FINALIZING →
 * SUCCEEDED. BLOCKED ends automation until an operator acts, and
 * `blockedPhase` says where it stopped: STOPPING_PROVISIONING before Core
 * authorized the database drop (the database still exists; abandon it), or
 * DROPPING_DATABASE / FINALIZING after it (the database may be gone; resume
 * it). ABANDONED (an operator gave the request up) only ever follows a stop
 * before the drop, so the tenant database still exists.
 */
export const TENANT_DESTROY_PHASES = [
  "STOPPING_PROVISIONING",
  "DROPPING_DATABASE",
  "FINALIZING",
  "SUCCEEDED",
  "BLOCKED",
  "ABANDONED",
] as const;

export type TenantDestroyPhase = (typeof TENANT_DESTROY_PHASES)[number];

/** The phases Worker still advances; SUCCEEDED, BLOCKED and ABANDONED are final. */
export const TENANT_DESTROY_ADVANCING_PHASES = [
  "STOPPING_PROVISIONING",
  "DROPPING_DATABASE",
  "FINALIZING",
] as const satisfies readonly TenantDestroyPhase[];

/**
 * Where a BLOCKED request stopped. DROPPING_DATABASE and FINALIZING mean Core
 * had already authorized the drop: the request halted in place, cannot be
 * abandoned, and a new destruction request resumes it.
 */
export const TENANT_DESTROY_BLOCKED_PHASES = [
  "STOPPING_PROVISIONING",
  "DROPPING_DATABASE",
  "FINALIZING",
] as const satisfies readonly TenantDestroyPhase[];

export type TenantDestroyBlockedPhase =
  (typeof TENANT_DESTROY_BLOCKED_PHASES)[number];

export interface TenantDestroyView {
  operationId: string;
  tenantId: string;
  phase: TenantDestroyPhase;
  requestedAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Safe code explaining why the latest attempt waited or failed. */
  lastErrorCode: string | null;
  /** Attempts made in the current phase. */
  attempts: number;
  /** When Worker next advances the request; null once automation has ended. */
  nextAttemptAt: string | null;
  blockedAt: string | null;
  /** Safe code that blocked the request; kept after it is abandoned. */
  blockedReason: string | null;
  /**
   * The phase a BLOCKED request stopped in, kept on a later ABANDONED one
   * (always STOPPING_PROVISIONING there); null exactly when `blockedAt` is.
   */
  blockedPhase: TenantDestroyBlockedPhase | null;
  /** Provisioning operation the stop waits on, or waited on before it blocked. */
  blockingOperationId: string | null;
  abandonedAt: string | null;
}
