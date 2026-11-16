"use client";

import { Button, Card, Combobox, Field, Input, NameSelect } from "@/design-system";
import type { useInventoryAvailability } from "../hooks/useInventoryAvailability";

export function AvailabilityQuery({ state }: { state: ReturnType<typeof useInventoryAvailability> }) {
  const { t, values, references, selectedItem, itemLoading, isLoading, setValue, queryRef, formField, formError, chooseItem } = state;
  const inv = t.tradeInventory;
  return <Card ref={queryRef} className="space-y-3 p-4">
    <div className="grid gap-4 md:grid-cols-3">
      <Field showLabel label={inv.itemId} required error={formField === "itemId" ? formError ?? undefined : undefined}>
        <Combobox value={values.itemId || undefined} selectedLabel={values.itemId ? references.itemLabel(values.itemId) : undefined}
          options={references.items.map((item) => ({ value: item.id, label: item.name, description: item.code }))}
          onValueChange={(id) => { if (id) void chooseItem(id); }} onSearch={references.searchItems}
          placeholder={inv.availabilitySelectItem} searchPlaceholder={t.common.search} loadingLabel={t.common.loading} emptyLabel={t.common.noData}
          loading={references.isLoading || itemLoading} disabled={isLoading || !references.canCatalog}
          errorContent={references.itemError ? <div role="alert" className="space-y-2 p-3 text-sm"><p>{inv.availabilityReferenceUnavailable}</p><Button variant="outline" size="sm" onClick={references.refresh}>{t.common.retry}</Button></div> : undefined} />
      </Field>
      <Field showLabel label={inv.nodeId} required error={formField === "nodeId" ? formError ?? undefined : undefined}>
        <NameSelect value={values.nodeId || undefined} options={references.nodes.filter((node) => node.status === "ACTIVE").map((node) => ({ value: node.id, label: `${node.name} · ${node.code}` }))}
          onValueChange={(id) => setValue("nodeId", id)} placeholder={inv.nodeId} disabled={isLoading || references.isLoading} />
      </Field>
      <Field showLabel label={inv.uomId} hint={inv.uomHint} error={formField === "uomId" ? formError ?? undefined : undefined}>
        <NameSelect value={values.uomId || undefined} options={references.uoms.map((unit) => ({ value: unit.id, label: `${unit.name} · ${unit.code}` }))}
          onValueChange={(id) => setValue("uomId", id)} placeholder={inv.uomId} disabled={isLoading || !values.itemId || itemLoading} />
      </Field>
    </div>
    {selectedItem?.trackingMode === "LOT" ? <div className="max-w-md"><Field showLabel label={inv.lotKey} required error={formField === "lotKey" ? formError ?? undefined : undefined}>
      <Input value={values.lotKey} maxLength={120} dir="ltr" disabled={isLoading} onChange={(event) => setValue("lotKey", event.target.value)} />
    </Field></div> : null}
    {selectedItem?.trackingMode === "SERIAL" ? <div className="max-w-md"><Field showLabel label={inv.serialKey} required error={formField === "serialKey" ? formError ?? undefined : undefined}>
      <Input value={values.serialKey} maxLength={120} dir="ltr" disabled={isLoading} onChange={(event) => setValue("serialKey", event.target.value)} />
    </Field></div> : null}
    {formError ? <p role="alert" className="text-sm text-negative-700 dark:text-negative-300">{formError}</p> : null}
    {!references.canCatalog || references.error ? <div className="flex flex-wrap items-center gap-3"><p role="status" className="text-sm text-muted-foreground">{inv.availabilityReferenceUnavailable}</p>
      {references.canCatalog ? <Button variant="outline" size="sm" onClick={references.refresh} disabled={references.isLoading}>{t.common.retry}</Button> : null}</div> : null}
  </Card>;
}
