export type { CorePage } from '../../../core/api/core-page';

export type Money = string; // ^(?:0|[1-9][0-9]{0,13})\.[0-9]{4}$ ; signed deltas may start with '-'
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}
export interface PageQuery {
  page: number;
  limit: number;
} // limit 1..100

// --- enums
export type SubscriptionStatus = 'PENDING_ACTIVATION' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export type AccessMode = 'FULL' | 'DUNNING' | 'READ_ONLY' | 'BLOCKED';
export type WalletStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
export type InvoiceListQuery = PageQuery & { status?: InvoiceStatus[]; from?: string; to?: string };
export type InvoicePurpose = 'TRIAL_ACTIVATION' | 'RENEWAL' | 'PRORATION' | 'MANUAL';
export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REQUIRES_REVIEW'
  | 'REFUND_PENDING'
  | 'REFUNDED';
export type PaymentProvider = 'PAYMOB' | 'INTERNAL' | 'OFFLINE';
export type PaymentPurpose = 'WALLET_TOP_UP' | 'INVOICE_SETTLEMENT';
export type RecoveryAction = 'CONTINUE_CHECKOUT' | 'CHECK_STATUS' | 'RECONCILIATION_REQUIRED';
export type LedgerReason = 'TOP_UP' | 'SUBSCRIPTION_CHARGE' | 'PRORATION_CREDIT' | 'REFUND' | 'PROMO' | 'ADJUSTMENT';
export type Lifecycle = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'DISABLED';
export type SourceKind = 'APPLICATION' | 'ADDON';
export type ChangeOperation = 'ADD' | 'CHANGE' | 'REMOVE' | 'ADOPT_DEFINITION';
export type OfferStatus = 'PARENT_REQUIRED' | 'INCOMPATIBLE' | 'UNAVAILABLE' | 'PREPARATION_REQUIRED';
export type OfferReason =
  | 'PARENT_REQUIRED'
  | 'PARENT_TIER_INCOMPATIBLE'
  | 'PRICE_UNAVAILABLE'
  | 'PREPARATION_REQUIRED';
export type LadderState = 'CONFIGURED' | 'UNCONFIGURED' | 'UNAVAILABLE';
export type CommercialOperationState =
  | 'PREPARING'
  | 'BLOCKED'
  | 'READY'
  | 'CONFIRMING'
  | 'COMMITTED'
  | 'ABORTED'
  | 'NEEDS_REVIEW';
export const PAYABLE_INVOICE_STATUSES: readonly InvoiceStatus[] = ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'];
export const PAYMENT_HOLD_STATUSES: readonly PaymentStatus[] = ['CREATED', 'PENDING', 'REQUIRES_REVIEW'];

// --- wallet, summary, invoices, payments
export interface WalletView {
  currencyCode: 'USD';
  balanceUsd: Money;
  reservedBalanceUsd: Money;
  availableBalanceUsd: Money;
  status: WalletStatus;
}
export interface TenantInvoiceView {
  id: string;
  number: string;
  status: InvoiceStatus;
  purpose: InvoicePurpose;
  currencyCode: string;
  canonicalUsd: boolean;
  subtotalUsd: Money | null;
  taxTotalUsd: Money | null;
  totalUsd: Money | null;
  amountPaidUsd: Money | null;
  outstandingUsd: Money | null;
  legacyOriginalAmounts: { currencyCode: string; subtotal: Money; taxTotal: Money; total: Money } | null;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
}
export interface BillingSummary {
  subscription: {
    id: string;
    status: SubscriptionStatus;
    billingCycle: BillingCycle | null;
    startedAt: string;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string;
    activationScheduledAt: string | null;
    totalPriceUsd: Money | null;
    accessMode: AccessMode;
  };
  wallet: WalletView;
  outstandingInvoice: TenantInvoiceView | null;
}
export interface AppliedPriceBracket {
  minUsers: number;
  maxUsers: number | null;
  chargedUsers: number;
  unitPriceUsd: Money;
  amountUsd: Money;
}
export interface AcceptedPricing {
  billingCycle: BillingCycle;
  currencyCode: 'USD';
  recurringAmountUsd: Money;
  priceRevision: string;
  breakdown: AppliedPriceBracket[];
}
export interface InvoiceReadHeader {
  id: string;
  subscriptionId: string;
  tenantId: string;
  number: string;
  status: InvoiceStatus;
  purpose: InvoicePurpose;
  currencyCode: string;
  subtotal: Money;
  taxTotal: Money;
  total: Money;
  settlementCurrencyCode: string;
  settlementSubtotalUsd: Money | null;
  settlementTaxTotalUsd: Money | null;
  settlementTotalUsd: Money | null;
  amountPaidUsd: Money;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}
interface LineBase {
  id: string;
  invoiceId: string;
  description: string;
  quantity: string;
  unitPrice: Money;
  lineTotal: Money;
}
export type InvoiceLine =
  | (LineBase & {
      sourceKind: null;
      baseItemId: null;
      addonSelectionId: null;
      addonDefinitionVersionId: null;
      acceptedSeats: null;
      acceptedPricingSnapshot: null;
    })
  | (LineBase & {
      sourceKind: 'APPLICATION';
      baseItemId: string;
      addonSelectionId: null;
      addonDefinitionVersionId: null;
      acceptedSeats: number;
      acceptedPricingSnapshot: AcceptedPricing;
    })
  | (LineBase & {
      sourceKind: 'ADDON';
      baseItemId: string;
      addonSelectionId: string;
      addonDefinitionVersionId: string;
      acceptedSeats: number;
      acceptedPricingSnapshot: AcceptedPricing;
    });
export interface InvoiceRead {
  invoice: InvoiceReadHeader;
  lines: InvoiceLine[];
}
export interface PaymentInputCurrencies {
  walletCurrencyCode: 'USD';
  items: { currencyCode: string; isBaseCurrency: boolean }[];
  total: number;
  topUpLimitsUsd?: { min: Money; max: Money };
}
export interface InvoicePaymentQuote {
  quoteId: string;
  invoiceId: string;
  invoiceOutstandingUsd: Money;
  walletAppliedUsd: Money;
  gatewayAmountUsd: Money;
  providerAmount: Money;
  providerCurrencyCode: string;
  currencyUnitsPerUsd: string;
  rateRevisionId: string | null;
  rateObservedAt: string;
  expiresAt: string;
}
export interface InvoicePaymentIntent {
  paymentId: string;
  status: PaymentStatus;
  checkoutUrl: string | null;
  requiresExternalPayment: boolean;
  expiresAt: string | null;
  invoiceStatus: InvoiceStatus;
  subscriptionStatus: SubscriptionStatus;
}
export interface ActiveInvoicePaymentIntent {
  paymentId: string;
  status: PaymentStatus;
  checkoutUrl: string | null;
  requiresExternalPayment: boolean;
  expiresAt: string | null;
  recoveryAction: RecoveryAction;
}
export interface PaymentStatusView {
  paymentId: string;
  purpose: PaymentPurpose;
  provider: PaymentProvider;
  status: PaymentStatus;
  invoiceId: string | null;
  invoiceStatus: InvoiceStatus | null;
  subscriptionStatus: SubscriptionStatus | null;
  providerAmount: Money;
  providerCurrencyCode: string;
  settlementAmountUsd: Money;
  walletAppliedUsd: Money;
  totalAppliedUsd: Money;
  createdAt: string;
  updatedAt: string;
}
export interface WalletLedgerEntry {
  id: string;
  walletId: string;
  direction: 'CREDIT' | 'DEBIT';
  amountUsd: Money;
  sourceAmount: Money;
  sourceCurrencyCode: string;
  currencyUnitsPerUsd: string | null;
  rateRevisionId: string | null;
  rateObservedAt: string | null;
  balanceAfterUsd: Money;
  reason: LedgerReason;
  actor: { type: 'ADMIN' | 'TENANT' | 'SYSTEM'; id: string | null };
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}
export interface TopupBody {
  amount: string;
  currencyCode: string;
} // amount ^(?:[1-9]\d{0,8}(?:\.\d{1,4})?|1000000000(?:\.0{1,4})?)$
export interface TopupResult {
  paymentId: string;
  checkoutUrl: string;
}

// --- subscription
export interface SubscriptionHeader {
  id: string;
  tenantId: string;
  allowedUsers: number;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currencyCode: 'USD';
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
  totalPrice: Money | null;
  createdAt: string;
  updatedAt: string;
  currentCollectionInvoiceId: string | null;
}
export interface SubscriptionBaseItem {
  id: string;
  applicationId: string;
  applicationKey: string;
  applicationName: string | null;
  tierId: string;
  tierKey: string;
  tierName: string | null;
  tierRank: number;
  seats: number;
  acceptedPricing: AcceptedPricing;
}
export interface SubscriptionAddonSelection {
  id: string;
  parentItemId: string;
  addonId: string;
  addonKey: string;
  definitionVersionId: string;
  seats: number;
  acceptedPricing: AcceptedPricing;
  effectiveState: {
    applicationLifecycleStatus: Lifecycle | null;
    addonLifecycleStatus: Lifecycle | null;
    definitionState: 'PUBLISHED' | 'REVOKED' | 'UNAVAILABLE';
    operationalUse: 'NOT_EVALUATED';
  };
}
export interface SubscriptionView {
  subscription: SubscriptionHeader;
  subscriptionRevision: string;
  baseItems: SubscriptionBaseItem[];
  addonSelections: SubscriptionAddonSelection[];
  baseAllowance: { allowedUsers: number; effectiveAllowedUsers: number; enabledApplications: string[] };
  totals: { baseRecurringUsd: Money; addonRecurringUsd: Money; combinedRecurringUsd: Money };
  projection: { observation: 'NOT_OBSERVED'; state: null; safeReasonCode: 'TENANT_PROJECTION_NOT_OBSERVED' };
}

// --- catalogue
export interface PriceBracket {
  minUsers: number;
  maxUsers: number | null;
  unitPrice: Money;
}
export interface OfferLadder {
  billingCycle: BillingCycle;
  state: LadderState;
  brackets: PriceBracket[];
  safeReasonCode: null | 'PRICE_NOT_CONFIGURED' | 'PRICE_UNAVAILABLE';
}
interface OfferCommon {
  application: { id: string; key: string; name: string; publicationVersionId: string; definitionRevision: string };
  ladders: [OfferLadder, OfferLadder]; // MONTHLY then ANNUAL
  status: OfferStatus;
  safeReasonCode: OfferReason;
}
export type SubscriptionOffer = OfferCommon &
  (
    | { sourceKind: 'APPLICATION'; tier: { id: string; key: string; name: string; rank: number } }
    | {
        sourceKind: 'ADDON';
        addon: {
          id: string;
          key: string;
          name: string;
          definitionVersionId: string;
          definitionVersion: string;
          definitionRevision: string;
          operationalRevision: string;
          compatibility: { mode: 'ALL_ACTIVE' | 'ALLOWLIST'; tierIds: string[] };
        };
      }
  );
export interface CatalogueQuery extends PageQuery {
  applicationKey?: string;
  parentTierId?: string;
}

// --- subscription change (prepare → operation → quote → apply)
export type CommercialChange =
  | { sourceKind: 'APPLICATION'; operation: 'ADD'; selectionKey: string; applicationId: string; tierId: string; seats: number }
  | { sourceKind: 'APPLICATION'; operation: 'CHANGE'; selectionKey: string; itemId: string; tierId?: string; seats?: number }
  | {
      sourceKind: 'ADDON';
      operation: 'ADD';
      selectionKey: string;
      addonId: string;
      targetDefinitionVersionId: string;
      seats: number;
      parentItemId?: string;
      parentSelectionKey?: string;
    }
  | { sourceKind: 'ADDON'; operation: 'CHANGE'; selectionKey: string; addonSelectionId: string; seats: number };
export interface PrepareBody {
  expectedSubscriptionRevision: string;
  changes: CommercialChange[];
  reason?: string;
} // changes 1..100
export interface QuoteBody extends PrepareBody {
  preparationId: string;
}
export interface CommercialOperation {
  operationId: string;
  operationRevision: string;
  intentKind: 'COMMERCIAL_CHANGE';
  state: CommercialOperationState;
  phase: string;
  createdAt: string;
  updatedAt: string;
  terminalAt: string | null;
  safeReasonCode: string | null;
  retryAfterSeconds: number | null;
  relatedPreviewId: string | null;
  committedReceiptRef: string | null;
  projectionState: 'NOT_REQUIRED' | 'PENDING' | 'READY' | 'BLOCKED';
}
export interface PreviewChange {
  ordinal: number;
  selectionKey: string;
  sourceKind: SourceKind;
  operation: ChangeOperation;
  applicationId: string;
  itemId: string | null;
  addonSelectionId: string | null;
  parentItemId: string | null;
  parentSelectionKey: string | null;
  addonId: string | null;
  fromSeats: number | null;
  toSeats: number | null;
  fromTierId: string | null;
  toTierId: string | null;
  fromDefinitionVersionId: string | null;
  toDefinitionVersionId: string | null;
  acceptedPricingBefore: AcceptedPricing | null;
  acceptedPricingAfter: AcceptedPricing | null;
  previousAmountUsd: Money;
  nextAmountUsd: Money;
  fullPeriodDeltaUsd: Money;
  proratedAllocationUsd: Money;
}
export type PreviewFinancial = {
  previousRecurringUsd: Money;
  nextRecurringUsd: Money;
  fullPeriodDeltaUsd: Money;
  direction: 'CREDIT' | 'DEBIT' | 'NONE';
  proratedAmountUsd: Money;
  canApply: boolean;
} & (
  | { walletStatus: WalletStatus; walletAvailableUsd: Money; walletShortfallUsd: Money }
  | { walletStatus: 'NOT_APPLICABLE'; walletAvailableUsd: null; walletShortfallUsd: null }
);
export interface CommercialPreview {
  previewId: string;
  subscriptionId: string;
  subscriptionRevision: string;
  operationId: string;
  actorBindingDigest: string;
  targetSetDigest: string;
  pricedAt: string;
  expiresAt: string;
  billingCycle: BillingCycle;
  currencyCode: 'USD';
  changes: PreviewChange[];
  financial: PreviewFinancial;
  preparation: { preparationId: string };
}
export interface AppliedReceipt {
  previewId: string;
  operationId: string;
  appliedAt: string;
  changes: { selectionKey: string; sourceKind: SourceKind; operation: ChangeOperation; selectionId: string }[];
  removedSelectionIds: string[];
  subscriptionRevision: string;
  totals: { baseRecurringUsd: Money; addonRecurringUsd: Money; combinedRecurringUsd: Money };
  settlement: null | {
    walletLedgerEntryId: string;
    walletId: string;
    currencyCode: 'USD';
    direction: 'CREDIT' | 'DEBIT';
    amountUsd: Money;
    balanceAfterUsd: Money;
  };
  projection: { state: 'PENDING'; preparationId: string };
}
export interface RecoveryBody {
  expectedOperationRevision: string;
  action: 'RECONCILE' | 'CANCEL_PREPARATION';
  reason: string;
} // reason 1..256
