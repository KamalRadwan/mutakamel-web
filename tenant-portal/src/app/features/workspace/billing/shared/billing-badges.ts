import {
  AccessMode,
  InvoicePurpose,
  InvoiceStatus,
  LedgerReason,
  OfferStatus,
  PaymentStatus,
  SubscriptionStatus,
  WalletStatus,
} from '../billing.model';

export const BILLING_BADGE_BASE =
  'inline-flex h-badge items-center rounded-8 px-8 text-12 leading-16 font-medium whitespace-nowrap';

export interface BillingBadge {
  readonly labelKey: string;
  readonly toneClass: string;
  readonly classes: string;
}

function badge(labelKey: string, toneClass: string): BillingBadge {
  return {
    labelKey,
    toneClass,
    classes: `${BILLING_BADGE_BASE} ${toneClass}`,
  };
}

export const INVOICE_STATUS_BADGES: Readonly<Record<InvoiceStatus, BillingBadge>> = {
  ISSUED: badge('bill.status.invoice.ISSUED', 'bg-brand-soft text-on-brand-soft'),
  PARTIALLY_PAID: badge('bill.status.invoice.PARTIALLY_PAID', 'bg-warning text-on-warning'),
  PAID: badge('bill.status.invoice.PAID', 'bg-success text-on-success'),
  OVERDUE: badge('bill.status.invoice.OVERDUE', 'bg-danger text-on-danger'),
  DRAFT: badge('bill.status.invoice.DRAFT', 'bg-neutral-soft text-text-muted'),
  VOID: badge('bill.status.invoice.VOID', 'bg-neutral-soft text-text-muted'),
};

export const PAYMENT_STATUS_BADGES: Readonly<Record<PaymentStatus, BillingBadge>> = {
  SUCCEEDED: badge('bill.status.payment.SUCCEEDED', 'bg-success text-on-success'),
  FAILED: badge('bill.status.payment.FAILED', 'bg-danger text-on-danger'),
  EXPIRED: badge('bill.status.payment.EXPIRED', 'bg-neutral-soft text-text-muted'),
  CREATED: badge('bill.status.payment.CREATED', 'bg-brand-soft text-on-brand-soft'),
  PENDING: badge('bill.status.payment.PENDING', 'bg-brand-soft text-on-brand-soft'),
  REQUIRES_REVIEW: badge('bill.status.payment.REQUIRES_REVIEW', 'bg-warning text-on-warning'),
  REFUND_PENDING: badge('bill.status.payment.REFUND_PENDING', 'bg-neutral-soft text-text-muted'),
  REFUNDED: badge('bill.status.payment.REFUNDED', 'bg-neutral-soft text-text-muted'),
};

export const SUBSCRIPTION_STATUS_BADGES: Readonly<Record<SubscriptionStatus, BillingBadge>> = {
  ACTIVE: badge('bill.status.subscription.ACTIVE', 'bg-success text-on-success'),
  TRIAL: badge('bill.status.subscription.TRIAL', 'bg-brand-soft text-on-brand-soft'),
  PAST_DUE: badge('bill.status.subscription.PAST_DUE', 'bg-warning text-on-warning'),
  CANCELLED: badge('bill.status.subscription.CANCELLED', 'bg-neutral-soft text-text-muted'),
  PENDING_ACTIVATION: badge('bill.status.subscription.PENDING_ACTIVATION', 'bg-brand-soft text-on-brand-soft'),
};

export const ACCESS_MODE_BADGES: Readonly<Record<AccessMode, BillingBadge>> = {
  FULL: badge('bill.access.FULL', 'bg-success text-on-success'),
  DUNNING: badge('bill.access.DUNNING', 'bg-warning text-on-warning'),
  READ_ONLY: badge('bill.badges.access.READ_ONLY', 'bg-neutral-soft text-text-muted'),
  BLOCKED: badge('bill.access.BLOCKED', 'bg-danger text-on-danger'),
};

export const WALLET_STATUS_BADGES: Readonly<Record<WalletStatus, BillingBadge>> = {
  ACTIVE: badge('bill.status.wallet.ACTIVE', 'bg-success text-on-success'),
  FROZEN: badge('bill.status.wallet.FROZEN', 'bg-warning text-on-warning'),
  CLOSED: badge('bill.status.wallet.CLOSED', 'bg-neutral-soft text-text-muted'),
};

export const OFFER_STATUS_BADGES: Readonly<Record<OfferStatus, BillingBadge>> = {
  PARENT_REQUIRED: badge('bill.offerStatus.PARENT_REQUIRED', 'bg-neutral-soft text-on-neutral-soft'),
  INCOMPATIBLE: badge('bill.offerStatus.INCOMPATIBLE', 'bg-neutral-soft text-on-neutral-soft'),
  UNAVAILABLE: badge('bill.offerStatus.UNAVAILABLE', 'bg-neutral-soft text-on-neutral-soft'),
  PREPARATION_REQUIRED: badge('bill.offerStatus.PREPARATION_REQUIRED', 'bg-neutral-soft text-on-neutral-soft'),
};

export const INVOICE_PURPOSE_BADGES: Readonly<Record<InvoicePurpose, BillingBadge>> = {
  TRIAL_ACTIVATION: badge('bill.purpose.TRIAL_ACTIVATION', 'bg-neutral-soft text-on-neutral-soft'),
  RENEWAL: badge('bill.purpose.RENEWAL', 'bg-neutral-soft text-on-neutral-soft'),
  PRORATION: badge('bill.purpose.PRORATION', 'bg-neutral-soft text-on-neutral-soft'),
  MANUAL: badge('bill.purpose.MANUAL', 'bg-neutral-soft text-on-neutral-soft'),
};

export const LEDGER_REASON_BADGES: Readonly<Record<LedgerReason, BillingBadge>> = {
  TOP_UP: badge('bill.ledgerReason.TOP_UP', 'bg-neutral-soft text-on-neutral-soft'),
  SUBSCRIPTION_CHARGE: badge('bill.ledgerReason.SUBSCRIPTION_CHARGE', 'bg-neutral-soft text-on-neutral-soft'),
  PRORATION_CREDIT: badge('bill.ledgerReason.PRORATION_CREDIT', 'bg-neutral-soft text-on-neutral-soft'),
  REFUND: badge('bill.ledgerReason.REFUND', 'bg-neutral-soft text-on-neutral-soft'),
  PROMO: badge('bill.ledgerReason.PROMO', 'bg-neutral-soft text-on-neutral-soft'),
  ADJUSTMENT: badge('bill.ledgerReason.ADJUSTMENT', 'bg-neutral-soft text-on-neutral-soft'),
};

export function invoiceStatusBadge(status: InvoiceStatus): BillingBadge {
  return INVOICE_STATUS_BADGES[status];
}

export function paymentStatusBadge(status: PaymentStatus): BillingBadge {
  return PAYMENT_STATUS_BADGES[status];
}

export function subscriptionStatusBadge(status: SubscriptionStatus): BillingBadge {
  return SUBSCRIPTION_STATUS_BADGES[status];
}

export function accessModeBadge(mode: AccessMode): BillingBadge {
  return ACCESS_MODE_BADGES[mode];
}

export function walletStatusBadge(status: WalletStatus): BillingBadge {
  return WALLET_STATUS_BADGES[status];
}

export function offerStatusBadge(status: OfferStatus): BillingBadge {
  return OFFER_STATUS_BADGES[status];
}

export function invoicePurposeBadge(purpose: InvoicePurpose): BillingBadge {
  return INVOICE_PURPOSE_BADGES[purpose];
}

export function ledgerReasonBadge(reason: LedgerReason): BillingBadge {
  return LEDGER_REASON_BADGES[reason];
}
