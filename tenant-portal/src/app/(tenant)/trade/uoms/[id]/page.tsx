"use client";

import Link from "next/link";
import { use } from "react";
import {
  ArrowLeftRight,
  Filter,
  Globe,
  Pencil,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  cn,
  ConfirmActionModal,
  ConflictDialog,
  DetailHeader,
  DetailSection,
  EmptyState,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  Skeleton,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { tradeLocalizedName } from "../../trade-validation";
import { EditUomDrawer } from "../components/UomDrawers";
import { useUomDetail } from "../hooks/useUomDetail";
import { getUomCatalogueMetadata } from "../uom-catalogue-metadata";

export default function TradeUomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const detail = useUomDetail(id);
  const { t, lang, uom, isLoading, error, isGone, scopeGap, reload } = detail;

  const metadata = uom
    ? getUomCatalogueMetadata(uom.code, uom.displayName, uom.localizedNames)
    : null;
  const palette = metadata ? SWATCH_SURFACE_PALETTES[metadata.hue] : null;
  const localeEntries = uom
    ? Object.entries(uom.localizedNames).filter(([, val]) => val.trim().length > 0)
    : [];

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex flex-col gap-4">
        <DetailHeader
          title={uom?.code ?? t.trade.uomsTitle}
          subtitle={uom?.displayName}
          backHref={TENANT_ROUTES.tradeUoms}
          backLabel={t.trade.backToUoms}
          status={
            uom && metadata && palette ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={uom.status === "ACTIVE" ? "positive" : "neutral"}>
                  {t.trade[`uomStatus_${uom.status}`]}
                </Badge>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    palette.badge,
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", palette.dot)}
                    aria-hidden="true"
                  />
                  {t.trade[`uomCategory_${metadata.category}`]}
                </span>
                {metadata.unEceCode ? (
                  <Badge tone="neutral" className="rounded-full px-2 py-0.5 text-2xs">
                    <IdentifierText>UN/ECE {metadata.unEceCode}</IdentifierText>
                  </Badge>
                ) : null}
              </div>
            ) : null
          }
          secondaryActions={
            uom ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={TENANT_ROUTES.tradeInventoryUomConversions}>
                    <ArrowLeftRight className="size-4" aria-hidden="true" />
                    {t.trade.uomOpenConversions}
                  </Link>
                </Button>
                {detail.canManage ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={detail.isSubmitting}
                      onClick={detail.openEdit}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      {t.trade.uomEditTitle}
                    </Button>
                    {uom.status === "ACTIVE" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={detail.isSubmitting}
                        onClick={detail.openRetire}
                        className="text-destructive"
                      >
                        <XCircle className="size-4" aria-hidden="true" />
                        {t.trade.uomRetire}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={detail.isSubmitting}
                        onClick={detail.openReactivate}
                      >
                        <RotateCcw className="size-4" aria-hidden="true" />
                        {t.trade.uomReactivate}
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
            ) : undefined
          }
        />

        <TradeScopeBar hideWhenSingleScope />

        {/* Retire Blocked Reference Protection Banner */}
        {detail.retireBlocked && uom ? (
          <div
            role="alert"
            className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive-subtle/50 p-4 shadow-2xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <ShieldAlert
                  className="mt-0.5 size-5 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div className="grid gap-1">
                  <span className="text-sm font-semibold text-foreground">
                    {t.trade.uomRetireBlockedTitle}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {t.trade.uomRetireBlockedExplanation}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={detail.dismissRetireBlocked}
                className="bg-card"
              >
                {t.common.close}
              </Button>
            </div>
            <ul className="grid gap-1.5 ps-7 text-xs text-foreground sm:grid-cols-3">
              <li className="rounded-md border border-border bg-card p-2.5">
                {t.trade.uomRetireBlockedItemMaster}
              </li>
              <li className="rounded-md border border-border bg-card p-2.5">
                {t.trade.uomRetireBlockedPriceLists}
              </li>
              <li className="rounded-md border border-border bg-card p-2.5">
                {t.trade.uomRetireBlockedQuotations}
              </li>
            </ul>
          </div>
        ) : null}

        {scopeGap ? (
          <EmptyState
            icon={Filter}
            title={t.trade.scopeRequiredTitle}
            description={t.trade.uomScopeRequiredDescription}
          />
        ) : isLoading ? (
          <Skeleton className="h-64" />
        ) : isGone ? (
          // No retry: the request succeeded and the answer was "gone".
          <NotFoundState
            title={t.trade.uomNotFoundTitle}
            description={t.trade.uomNotFoundDescription}
            backHref={TENANT_ROUTES.tradeUoms}
            backLabel={t.trade.backToUoms}
          />
        ) : error || !uom || !metadata || !palette ? (
          <ErrorState
            title={t.trade.uomLoadFailed}
            onRetry={reload}
            retryLabel={t.common.retry}
          />
        ) : (
          <div className="grid gap-4">
            {/* 1. Primary Unit Identity & Measurement Classification */}
            <DetailSection
              title={t.trade.uomDetailTitle}
              emptyValueLabel="—"
              fields={[
                {
                  label: t.trade.uomCode,
                  value: <IdentifierText>{uom.code}</IdentifierText>,
                },
                { label: t.trade.uomDisplayName, value: uom.displayName },
                {
                  label: t.trade.localizedName,
                  value: tradeLocalizedName(uom.localizedNames, lang),
                },
                {
                  label: t.trade.uomCategory,
                  value: (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        palette.badge,
                      )}
                    >
                      <span
                        className={cn("size-1.5 rounded-full", palette.dot)}
                        aria-hidden="true"
                      />
                      {t.trade[`uomCategory_${metadata.category}`]}
                    </span>
                  ),
                },
                {
                  label: t.trade.uomSource,
                  value: metadata.isStandard
                    ? t.trade.uomSourceStandard
                    : t.trade.uomSourceCustom,
                },
                ...(metadata.unEceCode
                  ? [
                      {
                        label: t.trade.uomUnEceCode,
                        value: (
                          <IdentifierText>{metadata.unEceCode}</IdentifierText>
                        ),
                      },
                    ]
                  : []),
                {
                  label: t.trade.version,
                  value: <IdentifierText>{uom.version}</IdentifierText>,
                },
                {
                  label: t.trade.updatedAt,
                  value: formatDateTime(uom.updatedAt, lang),
                },
              ]}
            />

            {/* 2. Regional & Export Translations Grid */}
            <section className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      {t.trade.uomDetailTranslationsTitle}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {t.trade.uomDetailTranslationsDescription}
                    </p>
                  </div>
                </div>
                <Badge tone="positive" className="rounded-full px-2.5 py-0.5 text-xs">
                  <IdentifierText>{localeEntries.length}</IdentifierText>
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {localeEntries.map(([loc, text]) => (
                  <div
                    key={loc}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/35 p-3"
                  >
                    <IdentifierText className="rounded-sm border border-border bg-card px-2 py-0.5 text-xs font-semibold text-foreground">
                      {loc.toUpperCase()}
                    </IdentifierText>
                    <span
                      dir="auto"
                      className="truncate text-sm font-medium text-foreground"
                    >
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Governance, Scope & Retirement Protection Rules */}
            <DetailSection
              title={t.trade.uomDetailGovernanceTitle}
              description={t.trade.uomDetailGovernanceDescription}
              emptyValueLabel="—"
              fields={[
                {
                  label: t.trade.uomDetailScopeRuleLabel,
                  value: t.trade.uomDetailScopeRuleValue,
                },
                {
                  label: t.trade.uomDetailRetireRuleLabel,
                  value: t.trade.uomDetailRetireRuleValue,
                },
              ]}
            />
          </div>
        )}

        {detail.editOpen && uom ? (
          <EditUomDrawer
            key={`${uom.id}-v${uom.version}`}
            uom={uom}
            isSubmitting={detail.isSubmitting}
            error={detail.formError}
            onClose={detail.closeEdit}
            onSubmit={detail.update}
          />
        ) : null}

        <ConfirmActionModal
          open={detail.retireOpen}
          onOpenChange={(open) => {
            if (!open) detail.closeRetire();
          }}
          title={t.trade.uomRetireTitle}
          description={t.trade.uomRetireDescription}
          confirmLabel={t.trade.uomRetire}
          cancelLabel={t.common.cancel}
          onConfirm={() => void detail.retire()}
          loading={detail.isSubmitting}
        />

        <ConfirmActionModal
          open={detail.reactivateOpen}
          onOpenChange={(open) => {
            if (!open) detail.closeReactivate();
          }}
          title={t.trade.uomReactivateTitle}
          description={t.trade.uomReactivateDescription}
          confirmLabel={t.trade.uomReactivate}
          cancelLabel={t.common.cancel}
          onConfirm={() => void detail.reactivate()}
          loading={detail.isSubmitting}
        />

        <ConflictDialog
          open={detail.conflict !== null}
          onOpenChange={(open) => {
            if (!open) detail.dismissConflict();
          }}
          title={t.trade.conflictTitle}
          description={t.trade.conflictDescription}
          theirChanges={
            detail.conflict ? (
              <span className="block text-xs">
                {detail.conflict.displayName}
                <IdentifierText className="ms-2 text-muted-foreground">
                  v{detail.conflict.version}
                </IdentifierText>
              </span>
            ) : null
          }
          onReload={detail.resolveConflict}
          onCancel={detail.dismissConflict}
          labels={{
            yourChanges: t.trade.conflictYours,
            theirChanges: t.trade.conflictTheirs,
            reload: t.trade.conflictReload,
            overwrite: t.trade.conflictReload,
            cancel: t.common.cancel,
          }}
        />
      </div>
    </PermissionGate>
  );
}
