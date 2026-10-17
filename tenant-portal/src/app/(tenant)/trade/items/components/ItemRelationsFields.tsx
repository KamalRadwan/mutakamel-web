"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Boxes, ChevronDown, Link2, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Combobox,
  DegradedBanner,
  Field,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { tradeLocalizedName } from "../../trade-validation";
import {
  formatTradeDecimal,
  isItemDecimalString,
  ITEM_RELATIONS_MAX,
} from "../item-contract";
import type {
  ComboComponentFormValue,
  ItemFormValues,
  OptionalProductFormValue,
} from "../item-contract";
import { useItemReferenceOptions } from "../hooks/useItemReferenceOptions";

interface ItemRelationsFieldsProps {
  values: ItemFormValues;
  disabled: boolean;
  enabled?: boolean;
  excludeItemId?: string;
  comboError?: string;
  optionalProductsError?: string;
  onChange: (patch: Partial<ItemFormValues>) => void;
}

export function ItemRelationsFields({
  values,
  disabled,
  enabled = true,
  excludeItemId,
  comboError,
  optionalProductsError,
  onChange,
}: ItemRelationsFieldsProps) {
  const { t, lang } = useI18n();
  const nextKey = useRef(1);
  const [comboOpen, setComboOpen] = useState(true);
  const [optionalOpen, setOptionalOpen] = useState(values.optionalProducts.length > 0);
  const selectedIds = [
    ...values.comboComponents.map((component) => component.itemId),
    ...values.optionalProducts.map((product) => product.itemId),
  ].filter(Boolean);
  const comboIds = values.comboComponents.map((component) => component.itemId).filter(Boolean);
  const optionalIds = values.optionalProducts.map((product) => product.itemId).filter(Boolean);
  const references = useItemReferenceOptions(enabled, selectedIds, excludeItemId);
  const options = references.items.map((item) => ({
    value: item.id,
    label: tradeLocalizedName(item.localizedNames, lang) || item.canonicalCode,
    description: item.canonicalCode,
  }));

  const findCode = (itemId: string) =>
    references.items.find((item) => item.id === itemId)?.canonicalCode;

  const addCombo = () =>
    onChange({
      comboComponents: [
        ...values.comboComponents,
        { key: `new-combo-${nextKey.current++}`, itemId: "", quantity: "1.00" },
      ],
    });

  const addOptional = () =>
    onChange({
      optionalProducts: [
        ...values.optionalProducts,
        { key: `new-optional-${nextKey.current++}`, itemId: "" },
      ],
    });

  return (
    <div className="grid gap-3.5">
      {values.itemKind === "COMBO" ? (
        <Collapsible
          open={comboOpen || Boolean(comboError)}
          onOpenChange={setComboOpen}
          className={cn(
            "overflow-hidden rounded-lg border bg-card shadow-2xs",
            comboError
              ? "border-destructive/50"
              : SWATCH_SURFACE_PALETTES.orange.sectionCard,
          )}
        >
          <CollapsibleTrigger className="min-h-11 w-full justify-between rounded-none bg-muted/25 px-4 py-2.5 text-start hover:bg-muted/45">
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border",
                  comboError
                    ? SWATCH_SURFACE_PALETTES.red.iconBoxIdle
                    : SWATCH_SURFACE_PALETTES.orange.iconBoxIdle,
                )}
              >
                <Boxes className="size-3.5" aria-hidden="true" />
              </span>
              <span className="truncate text-sm font-semibold text-foreground">
                {t.trade.itemComboComponents}
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                {t.trade.itemComboComponentsHint}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold",
                  comboError
                    ? SWATCH_SURFACE_PALETTES.red.badge
                    : SWATCH_SURFACE_PALETTES.orange.badge,
                )}
              >
                {formatTemplate(t.trade.itemComboComponentsCount, {
                  count: String(values.comboComponents.length),
                })}
              </span>
              <ChevronDown
                className={
                  comboOpen || comboError
                    ? "size-4 rotate-180 text-muted-foreground transition-transform"
                    : "size-4 text-muted-foreground transition-transform"
                }
                aria-hidden="true"
              />
            </span>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="grid gap-3 border-t border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {t.trade.itemComboComponentsHint}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCombo}
                  disabled={disabled || values.comboComponents.length >= ITEM_RELATIONS_MAX}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  {t.trade.itemAddComboComponent}
                </Button>
              </div>

              {values.comboComponents.map((component, index) => (
                <ComboRow
                  key={component.key}
                  component={component}
                  index={index}
                  count={values.comboComponents.length}
                  options={disableSelectedOptions(options, comboIds, component.itemId)}
                  selectedLabel={references.labelFor(component.itemId)}
                  selectedCode={findCode(component.itemId)}
                  loading={references.isLoading}
                  disabled={disabled}
                  onSearch={references.search}
                  onChange={(patch) =>
                    onChange({
                      comboComponents: values.comboComponents.map((entry) =>
                        entry.key === component.key ? { ...entry, ...patch } : entry,
                      ),
                    })
                  }
                  onRemove={() =>
                    onChange({
                      comboComponents: values.comboComponents.filter(
                        (entry) => entry.key !== component.key,
                      ),
                    })
                  }
                  onMove={(offset) =>
                    onChange({
                      comboComponents: move(values.comboComponents, index, offset),
                    })
                  }
                />
              ))}

              {comboError ? (
                <p role="alert" className="text-xs text-destructive">
                  {comboError}
                </p>
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <Collapsible
        open={optionalOpen || Boolean(optionalProductsError)}
        onOpenChange={setOptionalOpen}
        className={cn(
          "overflow-hidden rounded-lg border bg-card shadow-2xs",
          optionalProductsError ? "border-destructive/50" : "border-border",
        )}
      >
        <CollapsibleTrigger className="min-h-11 w-full justify-between rounded-none bg-muted/25 px-4 py-2.5 text-start hover:bg-muted/45">
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md border",
                optionalProductsError
                  ? SWATCH_SURFACE_PALETTES.red.iconBoxIdle
                  : SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
              )}
            >
              <Link2 className="size-3.5" aria-hidden="true" />
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              {t.trade.itemOptionalProducts}
            </span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              {t.trade.itemOptionalProductsHint}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold",
                SWATCH_SURFACE_PALETTES.green.badge,
              )}
            >
              <span>{t.trade.itemCrossSell}</span>
              {values.optionalProducts.length > 0 ? (
                <IdentifierText>{`(${values.optionalProducts.length})`}</IdentifierText>
              ) : null}
            </span>
            <ChevronDown
              className={
                optionalOpen || optionalProductsError
                  ? "size-4 rotate-180 text-muted-foreground transition-transform"
                  : "size-4 text-muted-foreground transition-transform"
              }
              aria-hidden="true"
            />
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="grid gap-3 border-t border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {t.trade.itemOptionalProductsHint}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOptional}
                disabled={disabled || values.optionalProducts.length >= ITEM_RELATIONS_MAX}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t.trade.itemAddOptionalProduct}
              </Button>
            </div>

            {values.optionalProducts.map((product, index) => (
              <OptionalRow
                key={product.key}
                product={product}
                index={index}
                count={values.optionalProducts.length}
                options={disableSelectedOptions(options, optionalIds, product.itemId)}
                selectedLabel={references.labelFor(product.itemId)}
                selectedCode={findCode(product.itemId)}
                loading={references.isLoading}
                disabled={disabled}
                onSearch={references.search}
                onChange={(itemId) =>
                  onChange({
                    optionalProducts: values.optionalProducts.map((entry) =>
                      entry.key === product.key ? { ...entry, itemId } : entry,
                    ),
                  })
                }
                onRemove={() =>
                  onChange({
                    optionalProducts: values.optionalProducts.filter(
                      (entry) => entry.key !== product.key,
                    ),
                  })
                }
                onMove={(offset) =>
                  onChange({
                    optionalProducts: move(values.optionalProducts, index, offset),
                  })
                }
              />
            ))}

            {optionalProductsError ? (
              <p role="alert" className="text-xs text-destructive">
                {optionalProductsError}
              </p>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {references.error ? (
        <DegradedBanner message={t.trade.itemRelatedLookupUnavailable} />
      ) : null}
    </div>
  );
}

function ComboRow({
  component,
  index,
  count,
  options,
  selectedLabel,
  selectedCode,
  loading,
  disabled,
  onSearch,
  onChange,
  onRemove,
  onMove,
}: {
  component: ComboComponentFormValue;
  index: number;
  count: number;
  options: Array<{ value: string; label: string; description?: string; disabled?: boolean }>;
  selectedLabel: string;
  selectedCode?: string;
  loading: boolean;
  disabled: boolean;
  onSearch: (query: string) => void;
  onChange: (patch: Partial<ComboComponentFormValue>) => void;
  onRemove: () => void;
  onMove: (offset: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-2.5 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_9.5rem_auto] sm:items-end">
      <Field label={`${t.trade.itemComponent} ${index + 1}`} showLabel required>
        <Combobox
          value={component.itemId || undefined}
          selectedLabel={component.itemId ? selectedLabel : undefined}
          leadingSlot={
            selectedCode ? (
              <Badge tone="caution">
                <IdentifierText>{selectedCode}</IdentifierText>
              </Badge>
            ) : undefined
          }
          onValueChange={(itemId) => onChange({ itemId: itemId ?? "" })}
          options={options}
          onSearch={onSearch}
          loading={loading}
          disabled={disabled}
          placeholder={t.trade.itemSelectRelated}
          searchPlaceholder={t.trade.itemSearchRelated}
          loadingLabel={t.common.loading}
          emptyLabel={t.trade.itemNoRelatedResults}
        />
      </Field>
      <Field label={t.trade.itemComponentQuantity} showLabel required>
        <div className="relative flex items-center">
          <Input
            size="sm"
            dir="ltr"
            placeholder="0.00"
            inputMode="decimal"
            className="pe-11 font-mono tabular-nums"
            value={component.quantity}
            onChange={(event) => onChange({ quantity: event.target.value })}
            onBlur={() => {
              if (
                component.quantity.trim() &&
                isItemDecimalString(component.quantity.trim())
              ) {
                onChange({ quantity: formatTradeDecimal(component.quantity) });
              }
            }}
            disabled={disabled}
          />
          <span
            className="pointer-events-none absolute end-2.5 text-2xs font-semibold text-muted-foreground"
            aria-hidden="true"
          >
            <IdentifierText>PCS</IdentifierText>
          </span>
        </div>
      </Field>
      <RowActions
        index={index}
        count={count}
        disabled={disabled}
        onMove={onMove}
        onRemove={onRemove}
      />
    </div>
  );
}

function OptionalRow({
  product,
  index,
  count,
  options,
  selectedLabel,
  selectedCode,
  loading,
  disabled,
  onSearch,
  onChange,
  onRemove,
  onMove,
}: {
  product: OptionalProductFormValue;
  index: number;
  count: number;
  options: Array<{ value: string; label: string; description?: string; disabled?: boolean }>;
  selectedLabel: string;
  selectedCode?: string;
  loading: boolean;
  disabled: boolean;
  onSearch: (query: string) => void;
  onChange: (itemId: string) => void;
  onRemove: () => void;
  onMove: (offset: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-2.5 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <Field label={`${t.trade.itemOptionalProduct} ${index + 1}`} showLabel required>
        <Combobox
          value={product.itemId || undefined}
          selectedLabel={product.itemId ? selectedLabel : undefined}
          leadingSlot={
            selectedCode ? (
              <Badge tone="positive">
                <IdentifierText>{selectedCode}</IdentifierText>
              </Badge>
            ) : undefined
          }
          onValueChange={(itemId) => onChange(itemId ?? "")}
          options={options}
          onSearch={onSearch}
          loading={loading}
          disabled={disabled}
          placeholder={t.trade.itemSelectRelated}
          searchPlaceholder={t.trade.itemSearchRelated}
          loadingLabel={t.common.loading}
          emptyLabel={t.trade.itemNoRelatedResults}
        />
      </Field>
      <RowActions
        index={index}
        count={count}
        disabled={disabled}
        onMove={onMove}
        onRemove={onRemove}
      />
    </div>
  );
}

function RowActions({
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  disabled: boolean;
  onMove: (offset: number) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex justify-end gap-1">
      <IconAction
        label={t.trade.itemMoveRelationUp}
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        icon={<ArrowUp className="size-4" aria-hidden="true" />}
      />
      <IconAction
        label={t.trade.itemMoveRelationDown}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
        icon={<ArrowDown className="size-4" aria-hidden="true" />}
      />
      <IconAction
        label={t.trade.itemRemoveRelation}
        disabled={disabled}
        onClick={onRemove}
        destructive
        icon={<Trash2 className="size-4" aria-hidden="true" />}
      />
    </div>
  );
}

function IconAction({
  label,
  disabled,
  onClick,
  icon,
  destructive = false,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={destructive ? "text-destructive" : undefined}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function move<T>(items: T[], index: number, offset: number): T[] {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function disableSelectedOptions(
  options: Array<{ value: string; label: string; description?: string }>,
  selectedIds: string[],
  currentId: string,
) {
  const selected = new Set(selectedIds);
  return options.map((option) => ({
    ...option,
    disabled: option.value !== currentId && selected.has(option.value),
  }));
}
