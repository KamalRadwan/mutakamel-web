"use client";

import { Button, Combobox, ErrorState, Field, FieldControlBoundary, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { formatNumber } from "@/lib/format/number";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { CATEGORY_PAGE_SIZE, type CategoryIntent, type ItemCategorySummary } from "../category-contract";
import { useCategoryPicker } from "../hooks/useCategoryPicker";

export function CategoryPicker({ value, onChange, disabled = false, enabled = true, error, currentSummary, scope = "TENANT", compact = false }: {
  value: CategoryIntent; onChange: (value: CategoryIntent) => void;
  disabled?: boolean; enabled?: boolean; error?: string;
  currentSummary?: ItemCategorySummary | null; scope?: "TENANT" | "OPERATING_CONTEXT";
  compact?: boolean;
}) {
  const { t, lang } = useI18n();
  const copy = t.trade.categories;
  const picker = useCategoryPicker(value, enabled, scope, currentSummary);
  const fullPath = picker.selected ? picker.selected.path.map((segment) => segment.name).join(" / ") : undefined;
  return (
    <div className={compact ? "" : "relative flex flex-col gap-1.5"}>
      {!compact ? (
        <FieldControlBoundary>
          <div className="end-0 -top-0.5 flex items-center sm:absolute">
            <Button
              type="button"
              variant={value.kind === "none" ? "secondary" : "outline"}
              size="xs"
              className="h-5 px-2 text-2xs"
              aria-pressed={value.kind === "none"}
              disabled={disabled}
              onClick={() => onChange({ kind: "none" })}
            >
              {copy.none}
            </Button>
          </div>
        </FieldControlBoundary>
      ) : null}
      <Field label={copy.choose} showLabel error={error} required={value.kind === "unresolved"}>
        <Combobox value={value.kind === "selected" ? value.id : undefined}
          selectedLabel={(compact ? fullPath : picker.selected?.name) ?? copy.unavailableSelection}
          placeholder={value.kind === "none" ? copy.none : copy.choose}
          searchPlaceholder={copy.search} loadingLabel={t.common.loading} emptyLabel={copy.noOptions}
          clearLabel={compact ? copy.none : undefined}
          options={picker.items.map((item) => ({ value: item.id, label: item.name, description: item.path.map((segment) => segment.name).join(" / ") }))}
          onValueChange={(id) => {
            if (!id) {
              onChange({ kind: "none" });
              return;
            }
            if (picker.choose(id)) onChange({ kind: "selected", id });
          }}
          onSearch={(query) => void picker.search(query)} loading={picker.loading} disabled={disabled || !enabled}
          errorContent={picker.error ? (
            <PermissionGate require={TRADE_PERMISSIONS.itemsRead} denied={picker.error.status === 403}>
              <ErrorState title={copy.loadFailed} onRetry={() => void picker.retry()} retryLabel={t.common.retry} />
            </PermissionGate>
          ) : undefined}
          footer={!picker.error ? <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" disabled={picker.loading || picker.page <= 1} onClick={() => void picker.setPage(picker.page - 1)}>{t.common.previousPage}</Button>
            <span className="text-xs text-muted-foreground" aria-live="polite">{formatTemplate(copy.pageSummary, { page: formatNumber(picker.page, lang), total: formatNumber(picker.total, lang) })}</span>
            <Button variant="ghost" size="sm" disabled={picker.loading || picker.page * CATEGORY_PAGE_SIZE >= picker.total} onClick={() => void picker.setPage(picker.page + 1)}>{t.common.nextPage}</Button>
          </div> : undefined}
        />
      </Field>
      {!compact && picker.selected ? <p className="wrap-anywhere text-xs text-muted-foreground">{fullPath}</p> : null}
      {value.kind === "selected" && picker.selected && "effectiveActive" in picker.selected && !picker.selected.effectiveActive
        ? <p className="text-xs text-muted-foreground">{copy.assignedInactive}</p> : null}
    </div>
  );
}
