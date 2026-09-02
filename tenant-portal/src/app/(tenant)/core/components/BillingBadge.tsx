"use client";

import { Badge, IdentifierText, resolveStatusRole, type BadgeProps, type StatusRole } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

/**
 * Every billing lifecycle this phase renders, keyed by the backend enum that
 * owns it. `SubscriptionStatus` and `AccessMode` are already in the design
 * system's `tone-map.ts`; the rest are Core billing enums it does not carry, so
 * their outcome roles live in the table below with the same discipline —
 * exhaustive, transcribed from source, never guessed.
 */
export type BillingEnumKind =
  | "SubscriptionStatus"
  | "AccessMode"
  | "InvoiceStatus"
  | "InvoicePurpose"
  | "PaymentStatus"
  | "PaymentPurpose"
  | "WalletStatus"
  | "LedgerDirection"
  | "LedgerReason"
  | "BillingCycle"
  | "ProrationDirection"
  | "PaymentRecoveryAction";

// Roles follow the OUTCOME each value represents, never its identity — a
// purpose or a provider is a category and gets no hue (docs/design/tokens.md).
// Sources, all under ../backend/mutakamel-apps/core-app/:
//   packages/database/src/enums/{invoice-status,invoice-purpose,payment-status,
//   payment-purpose,wallet-status,ledger-direction,ledger-reason}.enum.ts
//   src/tenant/payments/payments.service.ts (InvoicePaymentRecoveryAction)
const BILLING_TONE_MAP: Partial<Record<BillingEnumKind, Record<string, StatusRole>>> = {
  InvoiceStatus: {
    PAID: "positive",
    VOID: "negative",
    OVERDUE: "negative",
    PARTIALLY_PAID: "caution",
    DRAFT: "pending",
    ISSUED: "pending",
  },
  PaymentStatus: {
    SUCCEEDED: "positive",
    FAILED: "negative",
    EXPIRED: "negative",
    REQUIRES_REVIEW: "caution",
    REFUND_PENDING: "caution",
    REFUNDED: "caution",
    CREATED: "pending",
    PENDING: "pending",
  },
  WalletStatus: {
    ACTIVE: "positive",
    CLOSED: "negative",
    FROZEN: "caution",
  },
  LedgerDirection: {
    CREDIT: "positive",
    DEBIT: "caution",
  },
  // `prorationDirection` on a plan-change preview, which adds NONE to the two
  // ledger directions: the change moves no money at all.
  ProrationDirection: {
    CREDIT: "positive",
    DEBIT: "caution",
    NONE: "pending",
  },
  PaymentRecoveryAction: {
    CONTINUE_CHECKOUT: "pending",
    CHECK_STATUS: "pending",
    RECONCILIATION_REQUIRED: "caution",
  },
};

const ROLE_TO_TONE: Record<StatusRole, NonNullable<BadgeProps["tone"]>> = {
  positive: "positive",
  negative: "negative",
  caution: "caution",
  pending: "neutral",
};

function resolveRole(kind: BillingEnumKind, value: string): StatusRole | undefined {
  if (kind === "SubscriptionStatus" || kind === "AccessMode") {
    return resolveStatusRole(kind, value);
  }
  return BILLING_TONE_MAP[kind]?.[value];
}

export interface BillingBadgeProps {
  kind: BillingEnumKind;
  /** The wire value, exactly as it arrived. */
  value: string;
  className?: string;
}

/**
 * Renders one billing enum value with its translated label and its outcome
 * tone. Color is reinforcement; the label always carries the meaning.
 *
 * An unmapped value renders neutral with the raw wire string in monospace
 * rather than throwing. A backend that adds a payment status must not be able
 * to blank a screen the tenant pays their invoices on
 * (docs/architecture/data-layer.md#runtime-response-validation).
 */
export function BillingBadge({ kind, value, className }: BillingBadgeProps) {
  const { t } = useI18n();
  const role = resolveRole(kind, value);
  const label = t.coreBilling.enums[`${kind}.${value}`];

  if (!role || !label) {
    return (
      <Badge tone="neutral" className={className}>
        <IdentifierText>{label ?? value}</IdentifierText>
      </Badge>
    );
  }

  return (
    <Badge tone={ROLE_TO_TONE[role]} className={className}>
      {role === "pending" && (
        <span className="dot-pending size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
      )}
      {label}
    </Badge>
  );
}
