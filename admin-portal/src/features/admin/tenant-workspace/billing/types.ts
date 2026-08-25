import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export type BillingResourceState =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "forbidden"
  | "error";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PageView<T> {
  items: T[];
  meta: PaginationMeta;
}

export type SubscriptionStatus =
  | "TRIAL"
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED";

export type BillingCycle = "MONTHLY" | "ANNUAL";
export type WalletStatus = "ACTIVE" | "FROZEN" | "CLOSED";
export type LedgerDirection = "CREDIT" | "DEBIT";
export type LedgerReason =
  | "TOP_UP"
  | "SUBSCRIPTION_CHARGE"
  | "PRORATION_CREDIT"
  | "REFUND"
  | "PROMO"
  | "ADJUSTMENT";
export type BillingActorType = "ADMIN" | "TENANT" | "SYSTEM";
export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "REQUIRES_REVIEW"
  | "REFUND_PENDING"
  | "REFUNDED";
export type PaymentProvider = "PAYMOB" | "INTERNAL" | "OFFLINE";
export type PaymentPurpose = "WALLET_TOP_UP" | "INVOICE_SETTLEMENT";
export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID";
export type InvoicePurpose =
  | "TRIAL_ACTIVATION"
  | "RENEWAL"
  | "PRORATION"
  | "MANUAL";
export type PaymentReconciliationStatus = "PROPOSED" | "APPLIED" | "REJECTED";
export type AdminAdjustmentReason = "MANUAL_CREDIT" | "MANUAL_DEBIT";

export interface SubscriptionHeaderView {
  id: string;
  tenantId: string | null;
  allowedUsers: number;
  status: SubscriptionStatus;
  billingCycle: BillingCycle | null;
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

export interface SubscriptionItemView {
  id: string;
  subscriptionId: string;
  moduleId: string;
  tierId: string;
  seats: number;
  lineTotal: string;
  moduleKey?: string;
  moduleName?: string;
  tierKey?: string;
  tierName?: string;
  currencyCode?: string | null;
  features: string[] | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionView {
  subscription: SubscriptionHeaderView;
  effectiveAllowedUsers: number;
  enabledModules: string[];
  items: SubscriptionItemView[];
}

export interface SeedTenantSubscriptionDto {
  billingCycle: BillingCycle;
  currencyCode: "USD";
  trialDays?: number;
  items: Array<{ moduleKey: string; tierKey: string; seats: number }>;
}

export type SubscriptionPlanChangeOperation = "ADD" | "CHANGE" | "REMOVE";

type ModuleSelector =
  | { moduleId: string; moduleKey?: never }
  | { moduleId?: never; moduleKey: string };
type TierSelector =
  | { tierId: string; tierKey?: never }
  | { tierId?: never; tierKey: string };

export type CreateSubscriptionPlanChangePreviewDto =
  | ({
      operation: "ADD";
      itemId?: never;
      seats: number;
    } & ModuleSelector &
      TierSelector)
  | ({
      operation: "CHANGE";
      itemId: string;
      moduleId?: never;
      moduleKey?: never;
    } &
      (
        | (TierSelector & { seats?: number })
        | { tierId?: never; tierKey?: never; seats: number }
      ))
  | {
      operation: "REMOVE";
      itemId: string;
      moduleId?: never;
      moduleKey?: never;
      tierId?: never;
      tierKey?: never;
      seats?: never;
    };

export interface SubscriptionPlanChangePreviewView {
  previewId: string;
  subscriptionId: string;
  tenantId: string;
  operation: SubscriptionPlanChangeOperation;
  currencyCode: "USD";
  billingCycle: BillingCycle;
  itemSetFingerprint: string;
  planFingerprint: string;
  pricingRevision: string;
  pricedAt: string;
  expiresAt: string;
  item: {
    itemId: string | null;
    moduleId: string;
    fromTierId: string | null;
    toTierId: string | null;
    fromSeats: number | null;
    toSeats: number | null;
    previousLineTotalUsd: string;
    nextLineTotalUsd: string;
  };
  financial: {
    fullPeriodDeltaUsd: string;
    direction: LedgerDirection | "NONE";
    proratedAmountUsd: string;
    walletAvailableUsd: string;
    walletShortfallUsd: string;
    walletStatus: WalletStatus;
    canApply: boolean;
  };
}

export interface SubscriptionPlanChangeApplyResult {
  previewId: string;
  operation: SubscriptionPlanChangeOperation;
  appliedAt: string;
  item: SubscriptionPlanChangeAppliedItemView | null;
  removedItemId: string | null;
  wallet: { direction: LedgerDirection | "NONE"; amountUsd: string };
  subscriptionTotalUsd: string;
}

export interface SubscriptionPlanChangeAppliedItemView {
  id: string;
  subscriptionId: string;
  moduleId: string;
  tierId: string;
  seats: number;
  lineTotal: string;
}

export interface SubscriptionCancellationResult {
  tenantId: string;
  subscriptionId: string;
  status: SubscriptionStatus;
  cancelAt: string;
  scheduled: boolean;
  changed: boolean;
  appliedAt: string | null;
}

export interface WalletView {
  currencyCode: "USD";
  balanceUsd: string;
  reservedBalanceUsd: string;
  availableBalanceUsd: string;
  status: WalletStatus;
}

export interface WalletInputCurrencyView {
  currencyCode: string;
  isBaseCurrency: boolean;
}

export interface WalletInputCurrenciesView {
  walletCurrencyCode: "USD";
  items: WalletInputCurrencyView[];
  total: number;
}

export interface WalletLedgerView {
  id: string;
  walletId: string;
  direction: LedgerDirection;
  amountUsd: string;
  sourceAmount: string;
  sourceCurrencyCode: string;
  currencyUnitsPerUsd: string | null;
  rateRevisionId: string | null;
  rateObservedAt: string | null;
  balanceAfterUsd: string;
  reason: LedgerReason;
  actor: { type: BillingActorType; id: string | null };
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export type WalletAdjustmentDirection = LedgerDirection;

interface WalletAdjustmentDtoBase {
  sourceAmount: string;
  sourceCurrencyCode: string;
}

export type PreviewWalletAdjustmentDto =
  | (WalletAdjustmentDtoBase & {
      direction: "CREDIT";
      reasonCode: "MANUAL_CREDIT";
    })
  | (WalletAdjustmentDtoBase & {
      direction: "DEBIT";
      reasonCode: "MANUAL_DEBIT";
    });

export interface WalletAdjustmentPreviewView {
  quoteId: string;
  purpose: "ADMIN_WALLET_ADJUSTMENT";
  sourceAmount: string;
  sourceCurrencyCode: string;
  amountUsd: string;
  currencyUnitsPerUsd: string;
  rateRevisionId: string | null;
  rateObservedAt: string;
  expiresAt: string;
  direction: WalletAdjustmentDirection;
  reasonCode: AdminAdjustmentReason;
  balanceBeforeUsd: string;
  balanceAfterUsd: string;
}

export interface PaymentStatusView {
  paymentId: string;
  purpose: PaymentPurpose;
  provider: PaymentProvider;
  status: PaymentStatus;
  invoiceId: string | null;
  invoiceStatus: InvoiceStatus | null;
  subscriptionStatus: SubscriptionStatus | null;
  providerAmount: string;
  providerCurrencyCode: string;
  settlementAmountUsd: string;
  walletAppliedUsd: string;
  totalAppliedUsd: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfflinePaymentDto {
  amount: string;
  currencyCode: string;
  reference: string;
  note?: string;
}

export interface AdminCurrentCollectionInvoiceView {
  id: string;
  number: string;
  purpose: InvoicePurpose;
  status: InvoiceStatus;
  currencyCode: string;
  canonicalUsd: boolean;
  totalUsd: string | null;
  amountPaidUsd: string | null;
  outstandingUsd: string | null;
  legacyOriginalAmounts: {
    currencyCode: string;
    subtotal: string;
    taxTotal: string;
    total: string;
  } | null;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
}

export interface AdminTenantBillingSummaryView {
  tenantId: string;
  subscriptionId: string;
  currentCollectionInvoice: AdminCurrentCollectionInvoiceView | null;
}

export type PaymentReconciliationAction =
  | "CONFIRM_SUCCEEDED"
  | "CONFIRM_FAILED"
  | "CONFIRM_REFUNDED"
  | "CONFIRM_REFUND_FAILED";

export interface PaymentReconciliationView {
  id: string;
  paymentId: string;
  tenantId: string;
  action: PaymentReconciliationAction;
  status: PaymentReconciliationStatus;
  evidenceReference: string;
  providerOutcomeReference: string | null;
  proposalNote: string;
  proposedByAdminId: string;
  decidedByAdminId: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface PaymentReconciliationCaseView {
  payment: {
    paymentId: string;
    tenantId: string;
    status: PaymentStatus;
    purpose: PaymentPurpose;
    provider: PaymentProvider;
    invoiceId: string | null;
    failureCode: string | null;
    providerSucceededAt: string | null;
    providerSuccessEventReference: string | null;
    unexpectedRefundEventReference: string | null;
    unexpectedRefundProviderOutcomeReference: string | null;
    refundAttemptedAt: string | null;
    refundProviderReference: string | null;
    refundReservedUsd: string;
  };
  eligibleActions: PaymentReconciliationAction[];
  reconciliations: PaymentReconciliationView[];
}

export interface TenantBillingPermissions {
  canReadSubscription: boolean;
  canCreateSubscription: boolean;
  canUpdateSubscription: boolean;
  canApplySubscriptionUpdate: boolean;
  canCancelSubscription: boolean;
  canReadWallet: boolean;
  canPreviewWalletAdjustment: boolean;
  canConfirmWalletAdjustment: boolean;
  canReadBillingSummary: boolean;
  canRecordOfflinePayment: boolean;
  canRefundPayment: boolean;
  canReconcilePayment: boolean;
  canDecideReconciliation: boolean;
}

export interface BillingMutationState {
  name: string | null;
  error: NormalizedApiError | null;
}
