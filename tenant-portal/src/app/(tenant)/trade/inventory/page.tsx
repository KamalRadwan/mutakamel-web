"use client";

import { PackageSearch, RotateCcw } from "lucide-react";
import {
  Button,
  DegradedBanner,
  ErrorState,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PermissionGate,
  Skeleton,
  StatCard,
  SubNav,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDecimalString } from "@/lib/format/number";
import { formatDateTime } from "@/lib/format/date";
import { TRADE_INVENTORY_NAV_ITEMS } from "./inventory-nav";
import { INVENTORY_READ_PERMISSION } from "./inventory-contract";
import { useInventoryAvailability } from "./hooks/useInventoryAvailability";

export default function InventoryAvailabilityPage() {
  const {
    t,
    lang,
    canRead,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    values,
    result,
    isLoading,
    queryError,
    formError,
    setValue,
    reset,
    lookUp,
  } = useInventoryAvailability();

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeInventory.availabilityTitle}
        description={t.tradeInventory.availabilitySubtitle}
        primaryAction={{
          label: t.tradeInventory.lookUp,
          onClick: () => void lookUp(),
          disabled: isLoading || !isScopeResolved,
          loading: isLoading,
        }}
        secondaryActions={
          <>
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isLoading}
            />
            <Button variant="outline" onClick={reset} disabled={isLoading}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t.tradeInventory.clearLookup}
            </Button>
          </>
        }
      />

      <SubNav items={TRADE_INVENTORY_NAV_ITEMS} />

      <DegradedBanner message={t.tradeInventory.availabilityAdvisory} />

      <div className="grid gap-3 md:grid-cols-3">
        <Field label={t.tradeInventory.nodeId} required error={formError ?? undefined}>
          <Input
            value={values.nodeId}
            onChange={(event) => setValue("nodeId", event.target.value)}
            placeholder={t.tradeInventory.uuidPlaceholder}
          />
        </Field>
        <Field label={t.tradeInventory.itemId} required>
          <Input
            value={values.itemId}
            onChange={(event) => setValue("itemId", event.target.value)}
            placeholder={t.tradeInventory.uuidPlaceholder}
          />
        </Field>
        <Field label={t.tradeInventory.uomId} hint={t.tradeInventory.uomHint}>
          <Input
            value={values.uomId}
            onChange={(event) => setValue("uomId", event.target.value)}
            placeholder={t.tradeInventory.uuidPlaceholder}
          />
        </Field>
        <Field label={t.tradeInventory.lotKey}>
          <Input
            value={values.lotKey}
            onChange={(event) => setValue("lotKey", event.target.value)}
          />
        </Field>
        <Field label={t.tradeInventory.serialKey}>
          <Input
            value={values.serialKey}
            onChange={(event) => setValue("serialKey", event.target.value)}
          />
        </Field>
      </div>

      {!isScopeResolved ? (
        <EmptyState
          icon={PackageSearch}
          title={t.tradeInventory.selectBranchFirst}
          description={t.tradeInventory.selectBranchFirstDescription}
        />
      ) : isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : queryError ? (
        <ErrorState
          title={t.tradeInventory.availabilityFailed}
          description={queryError.message}
          onRetry={() => void lookUp()}
          retryLabel={t.common.retry}
        />
      ) : result ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard
              label={t.tradeInventory.onHand}
              value={formatDecimalString(result.onHandQuantity, lang, {
                maximumFractionDigits: 8,
              })}
            />
            <StatCard
              label={t.tradeInventory.reserved}
              value={formatDecimalString(result.reservedQuantity, lang, {
                maximumFractionDigits: 8,
              })}
            />
            <StatCard
              label={t.tradeInventory.available}
              value={formatDecimalString(result.availableQuantity, lang, {
                maximumFractionDigits: 8,
              })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t.tradeInventory.asOf} {formatDateTime(result.asOf, lang)}
          </p>
        </>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title={t.tradeInventory.availabilityNotAsked}
          description={t.tradeInventory.availabilityNotAskedDescription}
        />
      )}
    </div>
  );

  // Route admission is the permission string OR tenant ownership: only
  // `is_tenant_owner` bypasses `TradePermissionsGuard`, and PermissionGate
  // cannot see that flag on its own.
  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
