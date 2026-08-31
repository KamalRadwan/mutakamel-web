"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Button,
  CORE_BILLING_NAV_ITEMS,
  DegradedBanner,
  ErrorState,
  PageHeader,
  ReadOnlyGate,
  Skeleton,
  SubNav,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useAccessModeLabels } from "../../hooks/useAccessModeLabels";
import { useBillingSummary } from "../hooks/useBillingSummary";
import { usePaymentsHistory } from "../hooks/usePaymentsHistory";
import { PaymentsHistoryTabs } from "./PaymentsHistoryTabs";
import { SubscriptionSnapshotCard } from "./SubscriptionSnapshotCard";
import { WalletTopupCard } from "./WalletTopupCard";

const USD = "USD";

/**
 * `/core/billing` — the owner's one view of what is owed, what is held, and
 * what has been collected.
 *
 * Owner-only with no permission string: the whole gate is `TenantOwnerGuard`,
 * applied by `OwnerGate` in `page.tsx`.
 */
export function BillingWorkspace() {
  const { t } = useI18n();
  const accessLabels = useAccessModeLabels();
  const billing = useBillingSummary();
  const history = usePaymentsHistory();

  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState(USD);

  const accessMode = billing.summary?.subscription.accessMode ?? null;
  const isPastDue = billing.summary?.subscription.status === "PAST_DUE";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.coreBilling.title}
        description={t.coreBilling.subtitle}
        secondaryActions={
          <>
            <Button variant="outline" asChild>
              <Link href={TENANT_ROUTES.coreBillingInvoices}>{t.coreBilling.invoicesTitle}</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => void billing.reload()}
              disabled={billing.isRefreshing}
            >
              <RefreshCw
                className={billing.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.coreBilling.reload}
            </Button>
          </>
        }
      />

      <SubNav items={CORE_BILLING_NAV_ITEMS} />

      {/* Dunning is a standing condition, not an event — a persistent strip,
          never a toast (MASTER-PLAN 6.14). It also states the login
          consequence, which is invisible from inside a session: while PAST_DUE
          the login path refuses every non-owner with SUBSCRIPTION_PAST_DUE. */}
      {isPastDue && <DegradedBanner message={t.coreBilling.dunningBanner} />}

      {billing.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : billing.summaryError || !billing.summary ? (
        <ErrorState
          title={t.coreBilling.summaryLoadFailed}
          description={billing.summaryError?.correlationId}
          onRetry={() => void billing.reload()}
          retryLabel={t.common.retry}
        />
      ) : (
        <ReadOnlyGate mode={accessMode} allowedDuringDunning labels={accessLabels}>
          <SubscriptionSnapshotCard
            subscription={billing.summary.subscription}
            outstandingInvoice={billing.summary.outstandingInvoice}
          />

          <WalletTopupCard
            wallet={billing.summary.wallet}
            currencies={billing.currencies}
            currenciesFailed={billing.currenciesFailed}
            amount={amount}
            currencyCode={currencyCode}
            onAmountChange={setAmount}
            onCurrencyChange={setCurrencyCode}
            onSubmit={() => {
              void billing.submitTopup(amount, currencyCode).then((accepted) => {
                if (accepted) setAmount("");
              });
            }}
            isSubmitting={billing.isToppingUp}
            error={billing.topupError}
            topup={billing.topup}
            onDismissTopup={billing.dismissTopup}
          />

          <PaymentsHistoryTabs history={history} />
        </ReadOnlyGate>
      )}
    </div>
  );
}
