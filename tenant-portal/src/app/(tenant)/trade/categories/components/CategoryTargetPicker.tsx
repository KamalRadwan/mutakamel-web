"use client";

import { Button, Combobox, ErrorState, Field, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { CATEGORY_PAGE_SIZE, type CategoryDetail, type CategoryIntent } from "../category-contract";
import { useCategoryTargets } from "../hooks/useCategoryTargets";

export function CategoryTargetPicker({ mode, source, value, onChange, disabled, error }: {
  mode: "parent" | "before"; source: CategoryDetail | null; value: CategoryIntent;
  onChange: (value: CategoryIntent) => void; disabled: boolean; error?: string;
}) {
  const { t } = useI18n(); const copy = t.trade.categories;
  const targets = useCategoryTargets(mode, source);
  const noneLabel = mode === "parent" ? copy.root : copy.append;
  return <div className="space-y-2">
    <Field label={mode === "parent" ? copy.parent : copy.before} error={error} showLabel required>
      <Combobox value={value.kind === "selected" ? value.id : undefined}
        selectedLabel={targets.items.find((item) => value.kind === "selected" && item.id === value.id)?.name
          ?? targets.selected?.name ?? copy.unavailableSelection}
        placeholder={value.kind === "none" ? noneLabel : copy.choose}
        onValueChange={(id) => { if (id && targets.choose(id)) onChange({ kind: "selected", id }); }}
        options={targets.items.filter((item) => item.id !== source?.id).map((item) => ({
          value: item.id, label: item.name, description: item.path.map((segment) => segment.name).join(" / "),
          disabled: mode === "parent" && !item.effectiveActive,
        }))}
        onSearch={(query) => void targets.search(query)} loading={targets.loading} disabled={disabled}
        searchPlaceholder={copy.search} emptyLabel={copy.noMatches} loadingLabel={t.common.loading}
        errorContent={targets.error ? <PermissionGate require={TRADE_PERMISSIONS.itemsRead} denied={targets.error.status === 403}>
          <ErrorState title={copy.loadFailed} onRetry={() => void targets.retry()} retryLabel={t.common.retry} />
        </PermissionGate> : undefined}
        footer={!targets.error ? <div className="flex justify-between gap-2">
          <Button variant="ghost" size="sm" disabled={targets.loading || targets.page === 1} onClick={() => void targets.nextPage(targets.page - 1)}>{t.common.previousPage}</Button>
          <Button variant="ghost" size="sm" disabled={targets.loading || targets.page * CATEGORY_PAGE_SIZE >= targets.total} onClick={() => void targets.nextPage(targets.page + 1)}>{t.common.nextPage}</Button>
        </div> : undefined} />
    </Field>
    <Button size="sm" variant="outline" aria-pressed={value.kind === "none"} disabled={disabled}
      onClick={() => onChange({ kind: "none" })}>{noneLabel}</Button>
  </div>;
}
