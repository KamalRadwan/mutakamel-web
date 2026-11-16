"use client";

import { Eye, RefreshCw } from "lucide-react";
import { Button, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatDecimalString } from "@/lib/format/number";
import type { useInventoryAvailability } from "../hooks/useInventoryAvailability";

export function AvailabilitySession({ state }: { state: ReturnType<typeof useInventoryAvailability> }) {
  const { t, lang, history, references, isLoading } = state;
  const inv = t.tradeInventory;
  if (history.length === 0) return null;
  return <Card className="overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
    <div><h2 className="text-base font-semibold">{inv.availabilitySession}</h2><p className="text-sm text-muted-foreground">{inv.availabilitySessionHint}</p></div>
    <Button variant="ghost" size="sm" onClick={state.clearHistory}>{inv.availabilityClearSession}</Button>
  </div><div className="overflow-x-auto"><Table><TableHeader><TableRow>
    {[inv.itemId, inv.nodeId, inv.uomId, inv.onHand, inv.reserved, inv.available, inv.asOf, t.common.actions].map((label) => <TableHead key={label}>{label}</TableHead>)}
  </TableRow></TableHeader><TableBody>{history.map((entry) => <TableRow key={entry.key}>
    <TableCell><div>{references.itemLabel(entry.snapshot.itemId)}</div><bdi className="text-xs text-muted-foreground">{entry.query.lotKey || entry.query.serialKey}</bdi></TableCell>
    <TableCell>{references.nodeLabel(entry.snapshot.nodeId)}</TableCell>
    <TableCell>{entry.snapshot.uomId ? references.uomLabel(entry.snapshot.uomId) : "—"}</TableCell>
    {(["onHandQuantity", "reservedQuantity", "availableQuantity"] as const).map((key) =>
      <TableCell key={key} className="tabular-nums"><bdi>{formatDecimalString(entry.snapshot[key], lang, { maximumFractionDigits: 8 })}</bdi></TableCell>)}
    <TableCell>{formatDateTime(entry.snapshot.asOf, lang)}</TableCell>
    <TableCell><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => state.setInspected(entry)}><Eye className="size-4" aria-hidden="true" />{inv.viewSnapshot}</Button>
      <Button variant="outline" size="sm" disabled={isLoading} onClick={() => state.selectHistoryEntry(entry, true)}><RefreshCw className="size-4" aria-hidden="true" />{inv.availabilityRerun}</Button></div></TableCell>
  </TableRow>)}</TableBody></Table></div></Card>;
}
