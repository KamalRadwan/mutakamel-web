"use client";

import { Clock3, Eye, Info, RefreshCw } from "lucide-react";
import { Badge, Button, Card, cn, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatDecimalString } from "@/lib/format/number";
import type { AvailabilityFormValues, InventoryAvailability } from "../inventory-contract";
import type { useInventoryReferences } from "../hooks/useInventoryReferences";

interface Props { snapshot: InventoryAvailability; query: AvailabilityFormValues; references: ReturnType<typeof useInventoryReferences>;
  stale?: boolean; onRefresh?: () => void; onInspect?: () => void }
export function AvailabilitySnapshot({ snapshot, query, references, stale, onRefresh, onInspect }: Props) {
  const { t, lang } = useI18n();
  const inv = t.tradeInventory;
  const quantities = [
    { label: inv.onHand, value: snapshot.onHandQuantity, tone: "bg-info-subtle/35" },
    { label: inv.reserved, value: snapshot.reservedQuantity, tone: "bg-muted/45" },
    { label: inv.available, value: snapshot.availableQuantity,
      tone: snapshot.availableQuantity.startsWith("-") ? "bg-destructive/10" : "bg-success-subtle/40" },
  ];
  const quantity = (value: string) => formatDecimalString(value, lang, { maximumFractionDigits: 8 });
  return <Card className="space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1"><h2 className="text-lg font-semibold text-foreground">{references.itemLabel(snapshot.itemId)}</h2>
        <p className="text-sm text-muted-foreground">{references.nodeLabel(snapshot.nodeId)}</p>
        {query.lotKey || query.serialKey ? <IdentifierText>{query.lotKey || query.serialKey}</IdentifierText> : null}
      </div>
      <div className="flex items-center gap-2"><Badge tone={stale ? "caution" : "neutral"}>{stale ? inv.availabilityPrevious : inv.availabilitySnapshot}</Badge>
        {onRefresh ? <Button size="sm" variant="outline" onClick={onRefresh}><RefreshCw className="size-4" aria-hidden="true" />{inv.refreshSnapshot}</Button> : null}
        {onInspect ? <Button size="sm" variant="outline" onClick={onInspect}><Eye className="size-4" aria-hidden="true" />{inv.viewSnapshot}</Button> : null}
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">{quantities.map((item) => <div key={item.label} className={cn("space-y-1 rounded-lg border border-border px-4 py-3", item.tone)}>
      <p className="text-sm font-medium text-foreground-secondary">{item.label}</p>
      <p className="text-2xl font-semibold tabular-nums text-foreground"><bdi>{quantity(item.value)}</bdi></p>
      <p className="text-sm text-muted-foreground">{snapshot.uomId ? references.uomLabel(snapshot.uomId) : inv.uomId}</p>
    </div>)}</div>
    <p className="rounded-md bg-muted/35 px-3 py-2 text-center text-sm tabular-nums text-foreground-secondary">
      <bdi dir="ltr">{quantity(snapshot.onHandQuantity)} − {quantity(snapshot.reservedQuantity)} = {quantity(snapshot.availableQuantity)}</bdi>
    </p>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <p className="flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" />{inv.asOf} {formatDateTime(snapshot.asOf, lang)}</p>
      <p className="flex items-center gap-2"><Info className="size-4" aria-hidden="true" />{inv.availabilityAdvisory}</p>
    </div>
  </Card>;
}
