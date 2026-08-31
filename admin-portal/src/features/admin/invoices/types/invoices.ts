import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { PageResult, SortDirection } from "@/types/common";

export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_PURPOSES = [
  "TRIAL_ACTIVATION",
  "RENEWAL",
  "PRORATION",
  "MANUAL",
] as const;

export type InvoicePurpose = (typeof INVOICE_PURPOSES)[number];

export const INVOICE_TENANT_STATUSES = [
  "PROVISIONING",
  "PROVISIONING_FAILED",
  "ACTIVE",
  "SUSPENDED",
  "DELETED",
] as const;

export type InvoiceTenantStatus = (typeof INVOICE_TENANT_STATUSES)[number];

/** Safe tenant identity Core attaches to paginated admin invoice rows. */
export interface InvoiceTenantSummary {
  id: string;
  name: string;
  companyName: string;
  status: InvoiceTenantStatus;
}

export const INVOICE_SORT_FIELDS = [
  "number",
  "status",
  "total",
  "issuedAt",
  "dueAt",
  "createdAt",
] as const;

type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  descriptionI18n: { en: string; ar: string };
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  tenantId: string;
  /** Null on single-invoice reads and when the billed tenant is gone. */
  tenant: InvoiceTenantSummary | null;
  number: string;
  status: InvoiceStatus;
  purpose: InvoicePurpose;
  currencyCode: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  settlementCurrencyCode: string;
  settlementSubtotalUsd: string | null;
  settlementTaxTotalUsd: string | null;
  settlementTotalUsd: string | null;
  amountPaidUsd: string;
  fxUnitsPerUsd: string | null;
  fxRateRevisionId: string | null;
  fxObservedAt: string | null;
  settlementLockedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: InvoiceLine[];
}

export type InvoicePage = PageResult<Invoice>;

export interface CoreSnapshot<T> {
  data: T;
  correlationId: string;
  responseTimestamp: string;
}

export interface InvoiceListQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy: InvoiceSortField;
  sortDir: SortDirection;
  tenantId?: string;
  status?: InvoiceStatus;
}

export interface GenerateInvoiceDto {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  currencyCode?: string;
  purpose?: InvoicePurpose;
}

export interface InvoiceLineInputDto {
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface UpdateInvoiceDto {
  lines?: InvoiceLineInputDto[];
  dueAt?: string;
}

export interface IssueInvoiceDto {
  dueAt: string;
}

export interface InvoicePermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canIssue: boolean;
  canVoid: boolean;
  canRecordOfflinePayment: boolean;
}

export type InvoiceResourceState =
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "ERROR";

export type InvoiceMutationName = "GENERATE" | "UPDATE" | "ISSUE" | "VOID";
export type InvoiceMutationPhase =
  | "IDLE"
  | "PENDING"
  | "SUCCEEDED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "VALIDATION"
  | "IN_FLIGHT"
  | "UNAVAILABLE"
  | "ERROR";

export interface InvoiceMutationState {
  name: InvoiceMutationName | null;
  phase: InvoiceMutationPhase;
  error: NormalizedApiError | null;
  correlationId: string | null;
}

export interface InvoiceListFilterDraft {
  search: string;
  tenantId: string;
  status: "" | InvoiceStatus;
  sortBy: InvoiceSortField;
  sortDir: SortDirection;
  limit: string;
}

export interface GenerateInvoiceDraft {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  purpose: InvoicePurpose;
}

export interface InvoiceLineDraft {
  clientId: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface InvoiceEditDraft {
  lines: InvoiceLineDraft[];
  dueAt: string;
}

export interface CriticalInvoiceDraft {
  dueAt: string;
  reason: string;
  confirmed: boolean;
}

export type InvoiceValidationCode =
  | "INVALID_UUID_V7"
  | "SEARCH_TOO_LONG"
  | "INVALID_LIMIT"
  | "INVALID_PERIOD_START"
  | "INVALID_PERIOD_END"
  | "INVALID_PERIOD_RANGE"
  | "INVALID_DUE_DATE"
  | "DUE_DATE_CANNOT_CLEAR"
  | "LINES_REQUIRED"
  | "TOO_MANY_LINES"
  | "DESCRIPTION_REQUIRED"
  | "DESCRIPTION_TOO_LONG"
  | "INVALID_QUANTITY"
  | "INVALID_UNIT_PRICE"
  | "REASON_REQUIRED"
  | "REASON_TOO_LONG"
  | "CONFIRMATION_REQUIRED";

export type InvoiceValidationErrors = Record<string, InvoiceValidationCode>;
