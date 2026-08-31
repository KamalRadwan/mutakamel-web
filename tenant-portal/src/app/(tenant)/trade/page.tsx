"use client";

import Link from "next/link";
import { ChevronRight, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  DegradedBanner,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  SubNav,
  TRADE_FOUNDATION_NAV_ITEMS,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import {
  permittedTradeFoundationRoutes,
  TENANT_ROUTES,
  type TradeFoundationRoute,
} from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "./TradeScopeBar";
import { tradeEntitlementReasonKey, useTradeEntitlement } from "./useTradeEntitlement";

export default function TradeIndexPage() {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const entitlement = useTradeEntitlement();

  const copy: Record<TradeFoundationRoute, { title: string; description: string }> = {
    [TENANT_ROUTES.tradeItems]: {
      title: t.trade.itemsTitle,
      description: t.trade.itemsSubtitle,
    },
    [TENANT_ROUTES.tradeUoms]: {
      title: t.trade.uomsTitle,
      description: t.trade.uomsSubtitle,
    },
    [TENANT_ROUTES.tradeChannels]: {
      title: t.trade.channelsTitle,
      description: t.trade.channelsSubtitle,
    },
    [TENANT_ROUTES.tradeCommercialAccounts]: {
      title: t.trade.accountsTitle,
      description: t.trade.accountsSubtitle,
    },
    [TENANT_ROUTES.tradeConfiguration]: {
      title: t.trade.configurationTitle,
      description: t.trade.configurationSubtitle,
    },
  };

  const sections = permittedTradeFoundationRoutes(user?.permissions ?? []);
  const reason = t.trade[`entitlement_${tradeEntitlementReasonKey(entitlement.code)}`];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t.trade.homeTitle} description={t.trade.homeSubtitle} />

      <TradeScopeBar />

      <SubNav items={TRADE_FOUNDATION_NAV_ITEMS} />

      {/* Shaped like the card grid it replaces, not a spinner over a blank page. */}
      {entitlement.status === "checking" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : null}

      {/* The tenant, not the actor. `TradeSubscriptionGuard` refuses before the
          scope and permission guards, so this outranks everything below it. */}
      {entitlement.status === "unentitled" ? (
        <EmptyState
          icon={ShieldAlert}
          title={t.trade.entitlementTitle}
          description={reason}
        />
      ) : null}

      {entitlement.status === "failed" ? (
        <ErrorState
          title={t.trade.entitlementUnknownTitle}
          description={t.trade.entitlementUnknownDescription}
          onRetry={entitlement.reload}
          retryLabel={t.common.retry}
        />
      ) : null}

      {/* A permission refusal is not an entitlement refusal: the module is
          live and this actor's grants do not reach it at the selected scope. */}
      {entitlement.status === "forbidden" ? (
        <DegradedBanner message={t.trade.entitlementForbidden} />
      ) : null}

      {entitlement.status !== "checking" && entitlement.status !== "unentitled" ? (
        sections.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title={t.trade.homeEmptyTitle}
            description={t.trade.homeEmptyDescription}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((href) => (
              <Card key={href} className="hover:bg-accent">
                <CardContent>
                  <Link href={href} className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {copy[href].title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {copy[href].description}
                      </span>
                    </span>
                    <ChevronRight
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
