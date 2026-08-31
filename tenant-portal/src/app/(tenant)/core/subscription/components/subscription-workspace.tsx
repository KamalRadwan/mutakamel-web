"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Button,
  CORE_BILLING_NAV_ITEMS,
  DataTable,
  DateTime,
  DegradedBanner,
  DetailSection,
  ErrorState,
  Money,
  PageHeader,
  Skeleton,
  SubNav,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { BillingBadge } from "../../components/BillingBadge";
import { useBillingTableLabels } from "../../billing/hooks/useBillingTableLabels";
import type { SubscriptionItem } from "../subscription-contract";
import { usePlanChange } from "../hooks/usePlanChange";
import { useSubscription } from "../hooks/useSubscription";
import { SeatIncreaseDrawer } from "./SeatIncreaseDrawer";

/**
 * `assertPlanChangeLifecycle` in `subscription-items.service.ts` — the only two
 * statuses in which a plan change is accepted. The other three each have their
 * own conflict code, so the control is withdrawn rather than offered and then
 * refused.
 */
const PLAN_CHANGEABLE_STATUSES = ["TRIAL", "ACTIVE"];

export function SubscriptionWorkspace() {
  const { t, lang } = useI18n();
  const subscription = useSubscription();
  const planChange = usePlanChange(() => void subscription.reload());
  const labels = useBillingTableLabels(
    t.coreBilling.itemsLoadFailed,
    t.coreBilling.itemsEmpty,
  );

  const header = subscription.subscription?.header ?? null;
  const status = header?.status ?? null;
  const canChangePlan = status !== null && PLAN_CHANGEABLE_STATUSES.includes(status);

  const columns: ColumnDef<SubscriptionItem>[] = [
    {
      id: "module",
      header: t.coreBilling.module,
      cell: (item) => (
        <span className="text-foreground">{item.moduleName ?? item.moduleKey ?? item.moduleId}</span>
      ),
    },
    {
      id: "tier",
      header: t.coreBilling.tier,
      cell: (item) => item.tierName ?? item.tierKey ?? item.tierId,
    },
    {
      id: "seats",
      header: t.coreBilling.seats,
      numeric: true,
      cell: (item) => formatNumber(item.seats, lang),
    },
    {
      id: "lineTotal",
      header: t.coreBilling.lineTotal,
      numeric: true,
      cell: (item) => <Money value={item.lineTotalUsd} currency="USD" />,
    },
    ...(canChangePlan
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            cell: (item: SubscriptionItem) => (
              <Button variant="ghost" size="sm" onClick={() => planChange.open(item)}>
                {t.coreBilling.increaseSeats}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.coreBilling.subscriptionPageTitle}
        description={t.coreBilling.subscriptionPageSubtitle}
        titleAdornment={
          status ? <BillingBadge kind="SubscriptionStatus" value={status} /> : undefined
        }
        secondaryActions={
          <>
            <Button variant="outline" asChild>
              <Link href={TENANT_ROUTES.coreBilling}>{t.coreBilling.title}</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => void subscription.reload()}
              disabled={subscription.isRefreshing}
            >
              <RefreshCw
                className={subscription.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.coreBilling.reload}
            </Button>
          </>
        }
      />

      <SubNav items={CORE_BILLING_NAV_ITEMS} />

      {status && <LifecycleNotice status={status} />}

      {subscription.itemsFailed && <DegradedBanner message={t.coreBilling.itemsDegraded} />}

      {planChange.applied && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted p-3">
          <span className="text-xs text-foreground">
            {t.coreBilling.planChangeAppliedTitle}
          </span>
          <BillingBadge kind="ProrationDirection" value={planChange.applied.direction} />
          <Money value={planChange.applied.amountUsd} currency="USD" className="text-xs" />
          <span className="text-xs text-muted-foreground">
            {t.coreBilling.newSubscriptionTotal}
          </span>
          <Money
            value={planChange.applied.subscriptionTotalUsd}
            currency="USD"
            className="text-xs"
          />
          <Button variant="ghost" size="sm" onClick={planChange.dismissApplied}>
            {t.common.dismiss}
          </Button>
        </div>
      )}

      {subscription.isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : subscription.subscriptionError || !header ? (
        <ErrorState
          title={t.coreBilling.subscriptionLoadFailed}
          description={subscription.subscriptionError?.correlationId}
          onRetry={() => void subscription.reload()}
          retryLabel={t.common.retry}
        />
      ) : (
        <>
          <DetailSection
            title={t.coreBilling.renewalTerms}
            emptyValueLabel={t.coreBilling.notSet}
            fields={[
              {
                label: t.coreBilling.billingCycle,
                value: header.billingCycle ? (
                  <BillingBadge kind="BillingCycle" value={header.billingCycle} />
                ) : null,
              },
              {
                label: t.coreBilling.subscriptionTotal,
                value: header.totalPriceUsd ? (
                  <Money value={header.totalPriceUsd} currency="USD" />
                ) : null,
              },
              {
                label: t.coreBilling.seatsAllowed,
                value: formatNumber(subscription.subscription?.effectiveAllowedUsers ?? 0, lang),
              },
              {
                label: t.coreBilling.currentPeriodStart,
                value: header.currentPeriodStart ? (
                  <DateTime value={header.currentPeriodStart} precision="date" />
                ) : null,
              },
              {
                label: t.coreBilling.currentPeriodEnd,
                value: <DateTime value={header.currentPeriodEnd} precision="date" />,
              },
              {
                label: t.coreBilling.trialEndsAt,
                value: header.trialEndsAt ? (
                  <DateTime value={header.trialEndsAt} precision="date" />
                ) : null,
              },
              {
                label: t.coreBilling.activationScheduledAt,
                value: header.activationScheduledAt ? (
                  <DateTime value={header.activationScheduledAt} precision="date" />
                ) : null,
              },
              {
                label: t.coreBilling.cancelAt,
                value: header.cancelAt ? (
                  <DateTime value={header.cancelAt} precision="date" />
                ) : null,
              },
            ]}
          />

          <DataTable
            columns={columns}
            rows={subscription.items}
            isLoading={false}
            rowKey={(item) => item.id}
            labels={labels}
          />

          {!canChangePlan && <p className="text-xs text-muted-foreground">{t.coreBilling.planChangeUnavailable}</p>}
          <p className="text-xs text-muted-foreground">{t.coreBilling.addModuleUnavailable}</p>
        </>
      )}

      <SeatIncreaseDrawer planChange={planChange} onApplied={planChange.close} />
    </div>
  );
}

/**
 * The three of the **five** `SubscriptionStatusEnum` values that restrict
 * access. `SubscriptionEnforcementGuard` maps PENDING_ACTIVATION to BLOCKED,
 * PAST_DUE to DUNNING and CANCELLED to READ_ONLY.
 */
const RESTRICTED_STATUSES = ["PENDING_ACTIVATION", "PAST_DUE", "CANCELLED"];

/**
 * What the current status means, stated rather than re-derived.
 *
 * Whether a TRIAL or ACTIVE period has *expired* is a server-side clock
 * comparison and the authoritative `accessMode` lives on
 * `GET /billing/summary`, not on this route — so those two get an explanatory
 * line, and only the three genuinely restricted states get a banner. A caution
 * strip over a healthy subscription is how people learn to ignore caution
 * strips.
 */
function LifecycleNotice({ status }: { status: string }) {
  const { t } = useI18n();
  const message = t.coreBilling.lifecycleNotices[status];
  if (!message) return null;
  if (RESTRICTED_STATUSES.includes(status)) return <DegradedBanner message={message} />;
  return <p className="text-xs text-muted-foreground">{message}</p>;
}
