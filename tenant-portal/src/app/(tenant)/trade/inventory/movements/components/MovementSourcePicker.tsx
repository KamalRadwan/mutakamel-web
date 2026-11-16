"use client";
import { Button, Field, NameSelect } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useMovementSources } from "../hooks/useMovementSources";

export function MovementSourcePicker({ sources, isPurchase, disabled, onSelect, error }: {
  sources: ReturnType<typeof useMovementSources>; isPurchase: boolean; disabled: boolean; onSelect: (id: string) => void;
  error?: string;
}) {
  const { t } = useI18n();
  return <div className="flex flex-col gap-2">
    <Field label={isPurchase ? t.tradeInventory.movementPurchaseOrder : t.tradeInventory.movementSalesOrder} showLabel required
      hint={t.tradeInventory.movementSourcePageHint} error={error ?? sources.error ?? undefined}>
      <NameSelect value={sources.selectedId || undefined} options={sources.items.map(source => ({ value: source.id, label: source.label }))}
        placeholder={t.tradeInventory.movementChooseSource} disabled={disabled || sources.loading} onValueChange={onSelect} />
    </Field>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground" role="status">{sources.loading ? t.common.loading : t.tradeInventory.movementSourcePage.replace("{page}", String(sources.page))}</span>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={sources.refresh} disabled={disabled}>{t.common.retry}</Button>
        <Button type="button" size="sm" variant="outline" onClick={sources.previous} disabled={disabled || sources.page <= 1}>{t.common.previousPage}</Button>
        <Button type="button" size="sm" variant="outline" onClick={sources.next} disabled={disabled || sources.page * 100 >= sources.total}>{t.common.nextPage}</Button>
      </div>
    </div>
  </div>;
}
