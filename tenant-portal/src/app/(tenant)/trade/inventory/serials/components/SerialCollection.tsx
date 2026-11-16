"use client";

import { Eye, ScanBarcode } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { SERIAL_STATES, type InventorySerial } from "../../inventory-governance-contract";
import type { useInventorySerials } from "../hooks/useInventorySerials";

type ViewModel = ReturnType<typeof useInventorySerials>;

function SerialCard({ serial, vm }: { serial: InventorySerial; vm: ViewModel }) {
  const { t, lang, references } = vm;
  return <Card className="flex min-w-0 flex-col gap-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span dir="ltr" className="font-mono text-sm font-medium">{serial.serialKey}</span>
      <Badge tone={serial.state === "ON_HAND" ? "positive" : "neutral"}>{tradeStatusLabel(t.tradeStatus, serial.state, t.common.unknownCode)}</Badge>
    </div>
    <bdi className="text-sm text-foreground">{references.itemLabel(serial.itemId)}</bdi>
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div><dt className="text-muted-foreground">{t.tradeInventory.currentNode}</dt><dd><bdi>{serial.currentFulfillmentNodeId ? references.nodeLabel(serial.currentFulfillmentNodeId) : t.tradeInventory.serialNoCustody}</bdi></dd></div>
      <div><dt className="text-muted-foreground">{t.tradeInventory.lastTransitionAt}</dt><dd>{formatDateTime(serial.lastTransitionAt, lang)}</dd></div>
    </dl>
    <Button variant="outline" size="sm" onClick={() => vm.openSerial(serial.id)} className="self-start"><Eye className="size-4" aria-hidden="true" />{t.tradeInventory.readViews.viewLifecycle}</Button>
  </Card>;
}

export function SerialCollection({ view, vm }: { view: "card" | "board"; vm: ViewModel }) {
  const { t } = vm;
  if (vm.isLoading) return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  if (vm.queryError && !vm.isStale) return <ErrorState title={t.tradeInventory.serialsLoadFailed} description={vm.errorMessage} onRetry={() => void vm.reload()} retryLabel={t.common.retry} />;
  if (!vm.items.length) return <EmptyState icon={ScanBarcode} title={t.tradeInventory.serialsEmpty} />;
  return <div className="flex flex-col gap-3">
    <p className="text-sm text-muted-foreground">{t.tradeInventory.readViews.thisPage}</p>
    {view === "card" ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{vm.items.map((serial) => <SerialCard key={serial.id} serial={serial} vm={vm} />)}</div>
      : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{SERIAL_STATES.map((state) => <section key={state} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface-subtle p-3">
        <h2 className="flex items-center justify-between gap-2 text-sm font-medium">{tradeStatusLabel(t.tradeStatus, state, t.common.unknownCode)}<Badge tone="neutral">{formatNumber(vm.items.filter((row) => row.state === state).length, vm.lang)}</Badge></h2>
        {vm.items.filter((row) => row.state === state).map((serial) => <SerialCard key={serial.id} serial={serial} vm={vm} />)}
        {!vm.items.some((row) => row.state === state) && <p className="py-4 text-sm text-muted-foreground">{t.tradeInventory.serialStateEmpty}</p>}
      </section>)}</div>}
  </div>;
}
