"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Barcode,
  Boxes,
  CheckCircle2,
  Clock,
  Eye,
  LayoutGrid,
  List,
  Lock,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  Warehouse,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  DegradedBanner,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  IdentifierText,
  Input,
  PageHeader,
  PermissionGate,
  Skeleton,
  SWATCH_SURFACE_PALETTES,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { formatDateTime } from "@/lib/format/date";
import { InventoryModuleSubnav } from "./components/InventoryModuleSubnav";
import {
  computeStockComposition,
  INVENTORY_READ_PERMISSION,
  type InventoryAvailability,
} from "./inventory-contract";
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
    history,
    knownNodes,
    isLoading,
    queryError,
    formError,
    setValue,
    reset,
    lookUp,
    selectHistoryEntry,
  } = useInventoryAvailability();

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [inspected, setInspected] = useState<InventoryAvailability | null>(null);

  const inv = t.tradeInventory;
  const composition = result ? computeStockComposition(result) : null;
  const activeInspect = inspected ?? result;

  const resolveNodeLabel = (id: string) => {
    const match = knownNodes.find((n) => n.id === id);
    return match ? `${match.code} — ${match.name}` : id;
  };

  const content = (
    <div className="flex flex-col gap-3">
      <PageHeader
        className="sr-only"
        title={inv.availabilityTitle}
        description={inv.availabilitySubtitle}
        primaryAction={{
          label: inv.lookUp,
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
            <Button size="sm" variant="outline" onClick={reset} disabled={isLoading}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {inv.clearLookup}
            </Button>
          </>
        }
      />

      <InventoryModuleSubnav
        active="availability"
        scopeBadge={`BRANCH • ${INVENTORY_READ_PERMISSION}`}
      />

      {/* Colorful 4-Card Stock Formula KPI Strip */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.indigo.sectionCard,
            SWATCH_SURFACE_PALETTES.indigo.accentBorder,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
              )}
            >
              <Boxes className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {inv.onHand}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                {result ? resolveNodeLabel(result.nodeId) : inv.nodeId}
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
            {result
              ? formatDecimalString(result.onHandQuantity, lang, {
                  maximumFractionDigits: 4,
                })
              : "—"}
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.amber.sectionCard,
            SWATCH_SURFACE_PALETTES.amber.accentBorder,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                SWATCH_SURFACE_PALETTES.amber.iconBoxIdle,
              )}
            >
              <Lock className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {inv.reserved}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                {composition
                  ? `${formatNumber(composition.reservedPct, lang)}%`
                  : inv.reservationTab}
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
            {result
              ? formatDecimalString(result.reservedQuantity, lang, {
                  maximumFractionDigits: 4,
                })
              : "—"}
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.green.sectionCard,
            SWATCH_SURFACE_PALETTES.green.accentBorder,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
              )}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {inv.available}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                {composition
                  ? `${formatNumber(composition.availablePct, lang)}%`
                  : `${inv.onHand} − ${inv.reserved}`}
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-foreground">
            {result
              ? formatDecimalString(result.availableQuantity, lang, {
                  maximumFractionDigits: 4,
                })
              : "—"}
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
            SWATCH_SURFACE_PALETTES.teal.sectionCard,
            SWATCH_SURFACE_PALETTES.teal.accentBorder,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                SWATCH_SURFACE_PALETTES.teal.iconBoxIdle,
              )}
            >
              <Clock className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">
                {inv.asOf}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                {result ? formatDateTime(result.asOf, lang) : "advisory=true"}
              </span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
            {result ? `v${formatNumber(result.version, lang)}` : "v0"}
          </span>
        </div>
      </div>

      <DegradedBanner message={inv.availabilityAdvisory} />

      {/* Main Precision Lookup Card */}
      <Card className="flex flex-col gap-3.5 border-border p-4 shadow-2xs">
        {/* Fulfillment Node Quick-Select Chips */}
        {knownNodes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
              <Warehouse className="size-3" aria-hidden="true" />
              {inv.nodesTitle}:
            </span>
            {knownNodes.slice(0, 8).map((node) => {
              const selected = values.nodeId.trim() === node.id;
              return (
                <Button
                  key={node.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setValue("nodeId", node.id)}
                  className={cn(
                    "inline-flex h-auto items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-semibold transition-colors",
                    selected
                      ? SWATCH_SURFACE_PALETTES.indigo.pillActive
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <IdentifierText className="text-2xs font-semibold">
                    {node.code}
                  </IdentifierText>
                  <span>{node.name}</span>
                </Button>
              );
            })}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Field
            label={inv.nodeId}
            required
            error={formError ?? undefined}
          >
            <Input
              size="sm"
              value={values.nodeId}
              onChange={(event) => setValue("nodeId", event.target.value)}
              placeholder={inv.uuidPlaceholder}
            />
          </Field>
          <Field label={inv.itemId} required>
            <Input
              size="sm"
              value={values.itemId}
              onChange={(event) => setValue("itemId", event.target.value)}
              placeholder={inv.uuidPlaceholder}
            />
          </Field>
          <Field label={inv.uomId} hint={inv.uomHint}>
            <Input
              size="sm"
              value={values.uomId}
              onChange={(event) => setValue("uomId", event.target.value)}
              placeholder={inv.uuidPlaceholder}
            />
          </Field>
          <Field
            label={inv.lotKey}
            hint={`${values.lotKey.trim().length}/120`}
          >
            <Input
              size="sm"
              placeholder={inv.lotKey}
              value={values.lotKey}
              onChange={(event) => setValue("lotKey", event.target.value)}
            />
          </Field>
          <Field
            label={inv.serialKey}
            hint={`${values.serialKey.trim().length}/120`}
          >
            <Input
              size="sm"
              placeholder={inv.serialKey}
              value={values.serialKey}
              onChange={(event) => setValue("serialKey", event.target.value)}
            />
          </Field>
        </div>

        {/* Live Stock Composition Gauge Bar when a result is active */}
        {result && composition ? (
          <div
            className={cn(
              "mt-1 flex flex-col gap-2 rounded-lg border p-3",
              composition.health === "healthy"
                ? SWATCH_SURFACE_PALETTES.green.sectionCard
                : composition.health === "low"
                  ? SWATCH_SURFACE_PALETTES.amber.sectionCard
                  : SWATCH_SURFACE_PALETTES.red.sectionCard,
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge
                  tone={
                    composition.health === "healthy"
                      ? "positive"
                      : composition.health === "low"
                        ? "caution"
                        : "negative"
                  }
                >
                  {`${formatNumber(composition.availablePct, lang)}% ${inv.available}`}
                </Badge>
                <span className="font-medium text-foreground">
                  {resolveNodeLabel(result.nodeId)}
                </span>
                <span className="text-muted-foreground">•</span>
                <IdentifierText className="text-xs font-semibold">
                  {result.itemId}
                </IdentifierText>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {inv.asOf} {formatDateTime(result.asOf, lang)}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setInspected(result)}
                >
                  <Eye className="size-3.5" aria-hidden="true" />
                  360°
                </Button>
                <Button size="xs" variant="outline" asChild>
                  <Link href="/trade/inventory/movements">
                    <Activity className="size-3.5" aria-hidden="true" />
                    {inv.movementsTitle}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border bg-background">
              <div
                className="bg-positive-500 transition-all"
                style={{ width: `${composition.availablePct}%` }}
              />
              <div
                className="bg-caution-500 transition-all"
                style={{ width: `${composition.reservedPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </Card>

      {/* Primary Result / Loading / Error / Session Lookups */}
      {!isScopeResolved ? (
        <EmptyState
          icon={PackageSearch}
          title={inv.selectBranchFirst}
          description={inv.selectBranchFirstDescription}
        />
      ) : isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : queryError ? (
        <ErrorState
          title={inv.availabilityFailed}
          description={queryError.message}
          onRetry={() => void lookUp()}
          retryLabel={t.common.retry}
        />
      ) : !result && history.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={inv.availabilityNotAsked}
          description={inv.availabilityNotAskedDescription}
        />
      ) : null}

      {/* Session Pinned Lookups & View Switcher */}
      {history.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3.5 py-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <Badge tone="brand">{formatNumber(history.length, lang)}</Badge>
              <span className="text-xs font-semibold text-foreground">
                {inv.availabilityTitle}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="xs"
                variant={viewMode === "cards" ? "secondary" : "outline"}
                aria-pressed={viewMode === "cards"}
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="size-3.5" aria-hidden="true" />
                {t.trade.categories.cards}
              </Button>
              <Button
                size="xs"
                variant={viewMode === "table" ? "secondary" : "outline"}
                aria-pressed={viewMode === "table"}
                onClick={() => setViewMode("table")}
              >
                <List className="size-3.5" aria-hidden="true" />
                {t.trade.categories.list}
              </Button>
            </div>
          </div>

          {viewMode === "cards" ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {history.map((entry) => {
                const comp = computeStockComposition(entry.snapshot);
                const hue =
                  comp.health === "healthy"
                    ? "green"
                    : comp.health === "low"
                      ? "amber"
                      : "red";
                const palette = SWATCH_SURFACE_PALETTES[hue];
                return (
                  <Card
                    key={entry.key}
                    className={cn(
                      "flex flex-col gap-3 border border-s-4 p-4 shadow-2xs",
                      palette.sectionCard,
                      palette.accentBorder,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-foreground">
                          {resolveNodeLabel(entry.snapshot.nodeId)}
                        </span>
                        <IdentifierText className="block truncate text-2xs text-muted-foreground">
                          {entry.snapshot.itemId}
                        </IdentifierText>
                      </div>
                      <Badge
                        tone={
                          comp.health === "healthy"
                            ? "positive"
                            : comp.health === "low"
                              ? "caution"
                              : "negative"
                        }
                      >
                        {`${formatNumber(comp.availablePct, lang)}% ${inv.available}`}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-2.5 text-center">
                      <div>
                        <span className="block text-2xs text-muted-foreground">
                          {inv.onHand}
                        </span>
                        <span className="font-mono tabular-nums text-xs font-semibold text-foreground">
                          {formatDecimalString(entry.snapshot.onHandQuantity, lang, {
                            maximumFractionDigits: 4,
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="block text-2xs text-muted-foreground">
                          {inv.reserved}
                        </span>
                        <span className="font-mono tabular-nums text-xs font-semibold text-foreground">
                          {formatDecimalString(entry.snapshot.reservedQuantity, lang, {
                            maximumFractionDigits: 4,
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="block text-2xs text-muted-foreground">
                          {inv.available}
                        </span>
                        <span className="font-mono tabular-nums text-xs font-semibold text-foreground">
                          {formatDecimalString(entry.snapshot.availableQuantity, lang, {
                            maximumFractionDigits: 4,
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 text-2xs text-muted-foreground">
                      <span>
                        v{formatNumber(entry.snapshot.version, lang)} •{" "}
                        {formatDateTime(entry.snapshot.asOf, lang)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setInspected(entry.snapshot)}
                        >
                          <Eye className="size-3" aria-hidden="true" />
                          360°
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => selectHistoryEntry(entry, true)}
                        >
                          <RefreshCw className="size-3" aria-hidden="true" />
                          {inv.lookUp}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="overflow-hidden border-border shadow-2xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{inv.nodeId}</TableHead>
                    <TableHead>{inv.itemId}</TableHead>
                    <TableHead>{inv.uomId}</TableHead>
                    <TableHead>{inv.onHand}</TableHead>
                    <TableHead>{inv.reserved}</TableHead>
                    <TableHead>{inv.available}</TableHead>
                    <TableHead>{inv.asOf}</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.key}>
                      <TableCell className="font-medium">
                        {resolveNodeLabel(entry.snapshot.nodeId)}
                      </TableCell>
                      <TableCell>
                        <IdentifierText>{entry.snapshot.itemId}</IdentifierText>
                      </TableCell>
                      <TableCell>
                        <IdentifierText>
                          {entry.snapshot.uomId ?? "—"}
                        </IdentifierText>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatDecimalString(entry.snapshot.onHandQuantity, lang, {
                          maximumFractionDigits: 4,
                        })}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatDecimalString(entry.snapshot.reservedQuantity, lang, {
                          maximumFractionDigits: 4,
                        })}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums font-semibold">
                        {formatDecimalString(entry.snapshot.availableQuantity, lang, {
                          maximumFractionDigits: 4,
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(entry.snapshot.asOf, lang)}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setInspected(entry.snapshot)}
                          >
                            360°
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => selectHistoryEntry(entry, true)}
                          >
                            {inv.lookUp}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      ) : null}

      {/* 360° Availability Snapshot Dossier Modal */}
      <Dialog
        open={Boolean(inspected)}
        onOpenChange={(open) => {
          if (!open) setInspected(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogTitle>{inv.availabilityTitle} — 360°</DialogTitle>
          <DialogDescription>{inv.availabilityAdvisory}</DialogDescription>
          {activeInspect ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div
                  className={cn(
                    "rounded-lg border p-3",
                    SWATCH_SURFACE_PALETTES.indigo.sectionCard,
                  )}
                >
                  <span className="text-2xs font-semibold text-muted-foreground">
                    {inv.onHand}
                  </span>
                  <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-foreground">
                    {formatDecimalString(activeInspect.onHandQuantity, lang, {
                      maximumFractionDigits: 8,
                    })}
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded-lg border p-3",
                    SWATCH_SURFACE_PALETTES.amber.sectionCard,
                  )}
                >
                  <span className="text-2xs font-semibold text-muted-foreground">
                    {inv.reserved}
                  </span>
                  <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-foreground">
                    {formatDecimalString(activeInspect.reservedQuantity, lang, {
                      maximumFractionDigits: 8,
                    })}
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded-lg border p-3",
                    SWATCH_SURFACE_PALETTES.green.sectionCard,
                  )}
                >
                  <span className="text-2xs font-semibold text-muted-foreground">
                    {inv.available}
                  </span>
                  <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-foreground">
                    {formatDecimalString(activeInspect.availableQuantity, lang, {
                      maximumFractionDigits: 8,
                    })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.nodeId}
                  </span>
                  <IdentifierText className="font-semibold">
                    {activeInspect.nodeId}
                  </IdentifierText>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.itemId}
                  </span>
                  <IdentifierText className="font-semibold">
                    {activeInspect.itemId}
                  </IdentifierText>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.uomId}
                  </span>
                  <IdentifierText className="font-semibold">
                    {activeInspect.uomId ?? "—"}
                  </IdentifierText>
                </div>
                <div>
                  <span className="block text-2xs text-muted-foreground">
                    {inv.asOf}
                  </span>
                  <span dir="ltr" className="font-mono font-semibold">
                    v{formatNumber(activeInspect.version, lang)} •{" "}
                    {formatDateTime(activeInspect.asOf, lang)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href="/trade/inventory/serials">
                    <Barcode className="size-3.5" aria-hidden="true" />
                    {inv.serialsTitle}
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/trade/inventory/movements">
                    <Activity className="size-3.5" aria-hidden="true" />
                    {inv.movementsTitle}
                  </Link>
                </Button>
                <Button size="sm" onClick={() => setInspected(null)}>
                  {t.common.close}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
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
