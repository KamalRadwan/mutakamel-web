import type {
  ApplicationCommercialMode,
  ApplicationSelectionBlocker,
  ApplicationTechnicalReadinessReason,
} from "@/features/admin/applications/types";

export type TenantRegistrationLoadState =
  "idle" | "loading" | "forbidden" | "error" | "empty" | "ready";

export type TenantBillingCycle = "MONTHLY" | "ANNUAL";

export interface ValidateTenantIdentityDto {
  name: string;
  companyName: string;
}

export interface ReverseGeocodeTenantAddressDto {
  latitude: number;
  longitude: number;
}

export interface TenantReverseGeocodedAddress {
  countryName: string;
  countryIsoCode: string;
  state?: string;
  stateCode?: string;
  city?: string;
  cityId?: number;
  district?: string;
  street1?: string;
  buildingNo?: string;
  postalCode?: string;
  landmark?: string;
  formattedAddress?: string;
}

type TenantIdentityValidationReason = "REQUIRED" | "TAKEN";

interface TenantIdentityFieldValidation {
  valid: boolean;
  available: boolean;
  reason?: TenantIdentityValidationReason;
  message: string;
}

export interface TenantIdentityValidationResult {
  valid: boolean;
  fields: {
    name: TenantIdentityFieldValidation;
    companyName: TenantIdentityFieldValidation;
  };
  message: string;
}

export interface TenantIdentityValidationEvidence {
  fingerprint: string;
  result: TenantIdentityValidationResult;
}

interface TenantApplicationTierOption {
  id: string;
  key: string;
  name: string;
  rank: number;
}

export interface TenantApplicationCandidate {
  applicationId: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  commercialMode: ApplicationCommercialMode;
  technicalDefinitionRevision: string;
  selectionAllowed: boolean;
  selectionBlockers: ApplicationSelectionBlocker[];
  readinessReasons: ApplicationTechnicalReadinessReason[];
  catalogueReasons: Array<"ACTIVE_TIER_REQUIRED">;
  tiers: TenantApplicationTierOption[];
}

export interface TenantApplicationSelection {
  tierId: string;
  seats: number;
}

export interface TenantSubscriptionLine {
  applicationId: string;
  applicationKey: string;
  applicationName: string;
  tierId: string;
  tierKey: string;
  tierName: string;
  seats: number;
}

export interface TenantDatabasePlacementOption {
  id: string;
  name: string;
  status: "ACTIVE";
  countryName?: string;
  countryIsoCode?: string;
  currentTenants: number;
  maxTenants: number;
}

interface TenantProvisioningSeedPackPreview {
  key: string;
  version: string;
  policy: string;
  checksum?: string;
}

interface TenantProvisioningComponentPreview {
  componentId: string;
  componentKey: string;
  ownerApp: string;
  selectionSource: "FOUNDATION" | "ENTITLEMENT" | "DEPENDENCY";
  dependsOnComponentKeys: string[];
  required: boolean;
  activationRequired: boolean;
  releaseId: string;
  releaseVersion: string;
  manifestVersion: number;
  manifestChecksum: string;
  schemaTarget: string;
  schemaChecksum?: string;
  seedPacks: TenantProvisioningSeedPackPreview[];
}

interface TenantProvisioningStepPreview {
  stepKey: string;
  componentKey?: string;
  kind:
    | "DATABASE"
    | "SCHEMA"
    | "SYSTEM_SEED"
    | "REFERENCE_SEED"
    | "IDENTITY"
    | "CONFIG"
    | "VERIFICATION"
    | "NOTIFICATION"
    | "ACTIVATION";
  required: boolean;
  activationRequired: boolean;
  dependsOn: string[];
  targetVersion?: string;
  targetChecksum?: string;
}

export interface TenantProvisioningPlanPreview {
  contractVersion: 1;
  selectedApplicationKeys: string[];
  selectionDigest: string;
  components: TenantProvisioningComponentPreview[];
  steps: TenantProvisioningStepPreview[];
}

export interface TenantSubscriptionQuote {
  quoteId: string;
  requestHash: string;
  pricingRevision: string;
  billingCycle: TenantBillingCycle;
  currencyCode: "USD";
  total: string;
  totalUsd: string;
  items: Array<{
    moduleId: string;
    tierId: string;
    seats: number;
    lineTotal: string;
    lineTotalUsd: string;
  }>;
  expiresAt: string;
}

export interface TenantCreateCommand {
  quoteId: string;
  name: string;
  companyName: string;
  countryName: string;
  countryIsoCode: string;
  industry: string;
  timezone: string;
  phoneCountryCode: string;
  phone?: string;
  address: {
    city?: string;
    state?: string;
    district?: string;
    postalCode?: string;
    street1?: string;
    buildingNo?: string;
    landmark?: string;
    formattedAddress?: string;
  };
  taxNumber?: string;
  commercialRegistrationNumber?: string;
  databaseServerId: string;
  storageServerId: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPhoneCountryCode: string;
  ownerPhone: string;
  ownerJobTitle: string;
  ownerLanguage?: string;
  sendInvitation: boolean;
  ownerActive: boolean;
  subscription: {
    billingCycle: TenantBillingCycle;
    currencyCode: "USD";
    trialDays: number;
    items: Array<{
      moduleKey: string;
      tierKey: string;
      seats: number;
    }>;
  };
}

export interface TenantCreateResult {
  id: string;
  status: "PROVISIONING";
}
