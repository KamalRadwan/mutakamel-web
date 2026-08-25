import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export const SUBSCRIPTION_STATUSES = [
  "TRIAL",
  "PENDING_ACTIVATION",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_SORT_FIELDS = [
  "status",
  "currentPeriodEnd",
  "createdAt",
] as const;

export type SubscriptionSortField = (typeof SUBSCRIPTION_SORT_FIELDS)[number];
export type SortDirection = "ASC" | "DESC";

export type TenantStatus =
  "PROVISIONING" | "PROVISIONING_FAILED" | "ACTIVE" | "SUSPENDED" | "DELETED";

export interface SubscriptionHeader {
  id: string;
  tenantId: string | null;
  allowedUsers: number;
  status: SubscriptionStatus;
  billingCycle: string | null;
  currencyCode: string | null;
  startedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string;
  pendingPeriodStart: string | null;
  pendingPeriodEnd: string | null;
  trialDays: number;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  activationScheduledAt: string | null;
  activatedAt: string | null;
  cancelAt: string | null;
  totalPrice: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionItem {
  id: string;
  subscriptionId: string;
  moduleId: string;
  tierId: string;
  seats: number;
  lineTotal: string;
  createdAt?: string;
  updatedAt?: string;
  moduleKey?: string;
  moduleName?: string;
  tierKey?: string;
  tierName?: string;
  currencyCode?: string | null;
  features: string[] | null;
}

export interface SubscriptionTenantSummary {
  id: string;
  name: string;
  companyName: string;
  status: TenantStatus;
}

export interface SubscriptionListItem {
  subscription: SubscriptionHeader;
  effectiveAllowedUsers: number;
  enabledModules: string[];
  items: SubscriptionItem[];
  tenant: SubscriptionTenantSummary | null;
}

export interface SubscriptionPage {
  items: SubscriptionListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  correlationId: string;
  timestamp: string;
}

export interface SubscriptionListQuery {
  page: number;
  limit: number;
  status?: SubscriptionStatus;
  tenantId?: string;
  sortBy: SubscriptionSortField;
  sortDir: SortDirection;
}

export interface SubscriptionFilterDraft {
  status: "" | SubscriptionStatus;
  tenantId: string;
  sortBy: SubscriptionSortField;
  sortDir: SortDirection;
}

export type SubscriptionRequestState =
  "LOADING" | "READY" | "EMPTY" | "FORBIDDEN" | "UNAVAILABLE" | "ERROR";

export interface SubscriptionsViewModel {
  canRead: boolean;
  draft: SubscriptionFilterDraft;
  tenantIdError: string | null;
  data: SubscriptionPage | null;
  requestState: SubscriptionRequestState;
  error: NormalizedApiError | null;
  isRefreshing: boolean;
  page: number;
  limit: number;
  activeFilterCount: number;
  setDraftField: <K extends keyof SubscriptionFilterDraft>(
    field: K,
    value: SubscriptionFilterDraft[K],
  ) => void;
  applyFilters: () => boolean;
  clearFilters: () => void;
  refresh: () => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
}
