"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Boxes, ChevronDown, Link2, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Combobox,
  DegradedBanner,
  Field,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeLocalizedName } from "../../trade-validation";
import { ITEM_RELATIONS_MAX } from "../item-contract";
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

  const addCombo = () => onChange({
    comboComponents: [
      ...values.comboComponents,
      { key: `new-combo-${nextKey.current++}`, itemId: "", quantity: "1" },
    ],
  });
  const addOptional = () => onChange({
    optionalProducts: [
      ...values.optionalProducts,
      { key: `new-optional-${nextKey.current++}`, itemId: "" },
    ],
  });

  return (
    <div className="grid gap-3">
      {values.itemKind === "COMBO" ? (
        <RelationSection
          open={comboOpen || Boolean(comboError)}
          onOpenChange={setComboOpen}
          title={t.trade.itemComboComponents}
          icon={<Boxes className="size-4" aria-hidden="true" />}
        >
          <p className="text-xs text-muted-foreground">{t.trade.itemComboComponentsHint}</p>
          {values.comboComponents.map((component, index) => (
            <ComboRow
              key={component.key}
              component={component}
              index={index}
              count={values.comboComponents.length}
              options={disableSelectedOptions(options, comboIds, component.itemId)}
              selectedLabel={references.labelFor(component.itemId)}
              loading={references.isLoading}
              disabled={disabled}
              onSearch={references.search}
              onChange={(patch) => onChange({
                comboComponents: values.comboComponents.map((entry) =>
                  entry.key === component.key ? { ...entry, ...patch } : entry,
                ),
              })}
              onRemove={() => onChange({
                comboComponents: values.comboComponents.filter((entry) => entry.key !== component.key),
              })}
              onMove={(offset) => onChange({ comboComponents: move(values.comboComponents, index, offset) })}
            />
          ))}
          {comboError ? <p role="alert" className="text-xs text-destructive">{comboError}</p> : null}
          <Button type="button" variant="outline" size="sm" onClick={addCombo} disabled={disabled || values.comboComponents.length >= ITEM_RELATIONS_MAX} className="justify-self-start">
            <Plus className="size-4" aria-hidden="true" />
            {t.trade.itemAddComboComponent}
          </Button>
        </RelationSection>
      ) : null}

      <Collapsible
        open={optionalOpen || Boolean(optionalProductsError)}
        onOpenChange={setOptionalOpen}
        className="overflow-hidden rounded-md border border-border bg-card"
      >
        <CollapsibleTrigger className="min-h-11 w-full justify-between rounded-none px-4 py-2.5 text-start hover:bg-muted/40">
          <span className="flex items-center gap-2">
            <ChevronDown className={optionalOpen || optionalProductsError ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"} aria-hidden="true" />
            <Link2 className="size-4" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">{t.trade.itemOptionalProducts}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t.trade.itemCrossSell}</span>
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-3 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">{t.trade.itemOptionalProductsHint}</p>
            {values.optionalProducts.map((product, index) => (
              <OptionalRow
                key={product.key}
                product={product}
                index={index}
                count={values.optionalProducts.length}
                options={disableSelectedOptions(options, optionalIds, product.itemId)}
                selectedLabel={references.labelFor(product.itemId)}
                loading={references.isLoading}
                disabled={disabled}
                onSearch={references.search}
                onChange={(itemId) => onChange({
                  optionalProducts: values.optionalProducts.map((entry) =>
                    entry.key === product.key ? { ...entry, itemId } : entry,
                  ),
                })}
                onRemove={() => onChange({
                  optionalProducts: values.optionalProducts.filter((entry) => entry.key !== product.key),
                })}
                onMove={(offset) => onChange({ optionalProducts: move(values.optionalProducts, index, offset) })}
              />
            ))}
            {optionalProductsError ? <p role="alert" className="text-xs text-destructive">{optionalProductsError}</p> : null}
            <Button type="button" variant="outline" size="sm" onClick={addOptional} disabled={disabled || values.optionalProducts.length >= ITEM_RELATIONS_MAX} className="justify-self-start">
              <Plus className="size-4" aria-hidden="true" />
              {t.trade.itemAddOptionalProduct}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
      {references.error ? <DegradedBanner message={t.trade.itemRelatedLookupUnavailable} /> : null}
    </div>
  );
}

function ComboRow({
  component,
  index,
  count,
  options,
  selectedLabel,
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
  loading: boolean;
  disabled: boolean;
  onSearch: (query: string) => void;
  onChange: (patch: Partial<ComboComponentFormValue>) => void;
  onRemove: () => void;
  onMove: (offset: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
      <Field label={`${t.trade.itemComponent} ${index + 1}`} required>
        <Combobox
          value={component.itemId || undefined}
          selectedLabel={component.itemId ? selectedLabel : undefined}
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
      <Field label={t.trade.itemComponentQuantity} required>
        <Input size="sm" dir="ltr" inputMode="decimal" value={component.quantity} onChange={(event) => onChange({ quantity: event.target.value })} disabled={disabled} />
      </Field>
      <RowActions index={index} count={count} disabled={disabled} onMove={onMove} onRemove={onRemove} />
    </div>
  );
}

function OptionalRow({
  product,
  index,
  count,
  options,
  selectedLabel,
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
  loading: boolean;
  disabled: boolean;
  onSearch: (query: string) => void;
  onChange: (itemId: string) => void;
  onRemove: () => void;
  onMove: (offset: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <Field label={`${t.trade.itemOptionalProduct} ${index + 1}`} required>
        <Combobox
          value={product.itemId || undefined}
          selectedLabel={product.itemId ? selectedLabel : undefined}
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
      <RowActions index={index} count={count} disabled={disabled} onMove={onMove} onRemove={onRemove} />
    </div>
  );
}

function RowActions({ index, count, disabled, onMove, onRemove }: { index: number; count: number; disabled: boolean; onMove: (offset: number) => void; onRemove: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex justify-end gap-1">
      <IconAction label={t.trade.itemMoveRelationUp} disabled={disabled || index === 0} onClick={() => onMove(-1)} icon={<ArrowUp className="size-4" aria-hidden="true" />} />
      <IconAction label={t.trade.itemMoveRelationDown} disabled={disabled || index === count - 1} onClick={() => onMove(1)} icon={<ArrowDown className="size-4" aria-hidden="true" />} />
      <IconAction label={t.trade.itemRemoveRelation} disabled={disabled} onClick={onRemove} destructive icon={<Trash2 className="size-4" aria-hidden="true" />} />
    </div>
  );
}

function IconAction({ label, disabled, onClick, icon, destructive = false }: { label: string; disabled: boolean; onClick: () => void; icon: React.ReactNode; destructive?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={label} disabled={disabled} onClick={onClick} className={destructive ? "text-destructive" : undefined}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function RelationSection({
  open,
  onOpenChange,
  title,
  icon,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="overflow-hidden rounded-md border border-border bg-card">
      <CollapsibleTrigger className="min-h-11 w-full justify-between rounded-none px-4 py-2.5 text-start hover:bg-muted/40">
        <span className="flex items-center gap-2">
          <ChevronDown className={open ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"} aria-hidden="true" />
          {icon}
          <span className="text-sm font-medium text-foreground">{title}</span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent><div className="grid gap-3 border-t border-border p-4">{children}</div></CollapsibleContent>
    </Collapsible>
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
