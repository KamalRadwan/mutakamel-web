"use client";

import {
  BriefcaseBusiness,
  Boxes,
  ChevronDown,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Combobox,
  Field,
  FormModal,
  Input,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ITEM_CODE_MAX_LENGTH,
  ITEM_LOCALIZED_NAME_MAX_LENGTH,
  type ItemFormValues,
  type ItemKind,
} from "../item-contract";
import { useCreateItemForm } from "../hooks/useCreateItemForm";
import { ItemExtendedFields } from "./ItemExtendedFields";
import { ItemRelationsFields } from "./ItemRelationsFields";
import { CategoryPicker } from "../../categories/components/CategoryPicker";

interface CreateItemModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ItemFormValues) => Promise<boolean>;
}

export function CreateItemModal(props: CreateItemModalProps) {
  const { t, lang } = useI18n();
  const form = useCreateItemForm(props);
  const ItemIcon = form.values.itemKind === "PRODUCT"
    ? Package
    : form.values.itemKind === "SERVICE"
      ? BriefcaseBusiness
      : Boxes;
  const uomHint = form.uoms.isLoading
    ? t.trade.itemBaseUomLoading
    : form.uoms.isUnavailable
      ? t.trade.itemBaseUomUnavailable
      : t.trade.itemBaseUomHint;
  const selectedUom = form.uoms.all.find((uom) => uom.id === form.values.baseUomId);
  const uomLabel = (uom: { code: string; displayName: string }) => `${uom.code} — ${uom.displayName}`;

  return (
    <FormModal
      open={props.isOpen}
      onOpenChange={form.onOpenChange}
      title={t.trade.itemCreateTitle}
      description={t.trade.itemCreateDescription}
      size="wide"
      isDirty={form.isDirty}
      isSubmitting={props.isSubmitting}
      onSubmit={() => void form.submit()}
      error={props.error ?? undefined}
      labels={{
        submit: t.trade.itemCreateSubmit,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.trade.itemFormSections,
        sectionInvalid: t.trade.itemFormHasErrors,
        close: t.common.close,
      }}
    >
      <div className="grid w-full gap-4">
        <fieldset className="grid gap-2">
          <legend className="text-xs font-medium text-foreground">
            {t.trade.itemCreateKind} <span className="text-destructive" aria-hidden="true">*</span>
          </legend>
          <ToggleGroup
            type="single"
            value={form.values.itemKind}
            onValueChange={(next) => {
              if (next) form.setItemKind(next as ItemKind);
            }}
            size="md"
            disabled={props.isSubmitting}
            aria-label={t.trade.itemCreateKind}
            className="grid w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-3"
          >
            <ToggleGroupItem
              value="PRODUCT"
              className="gap-2 border border-border bg-card data-[state=on]:border-primary data-[state=on]:text-primary"
            >
              <Package className="size-5" aria-hidden="true" />
              {t.trade.itemKind_PRODUCT}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="SERVICE"
              className="gap-2 border border-border bg-card data-[state=on]:border-primary data-[state=on]:text-primary"
            >
              <BriefcaseBusiness className="size-5" aria-hidden="true" />
              {t.trade.itemKind_SERVICE}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="COMBO"
              className="gap-2 border border-border bg-card data-[state=on]:border-primary data-[state=on]:text-primary"
            >
              <Boxes className="size-5" aria-hidden="true" />
              {t.trade.itemKind_COMBO}
            </ToggleGroupItem>
          </ToggleGroup>
        </fieldset>

        <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="flex min-h-24 items-center gap-3 rounded-md border border-border bg-muted/30 p-3 md:min-h-56 md:flex-col md:items-stretch">
            <p className="shrink-0 text-xs text-muted-foreground">{t.trade.itemTypeIcon}</p>
            <div className="flex flex-1 items-center justify-center gap-3 text-center md:flex-col">
              <ItemIcon className="size-12 stroke-1 text-foreground md:size-16" aria-hidden="true" />
              <p className="text-xs text-muted-foreground">{t.trade.itemTypeGenerated}</p>
            </div>
          </aside>

          <div className="grid content-start gap-3">
            <div className="grid gap-3">
              <Field
                label={t.trade.itemCreateCode}
                hint={t.trade.itemCodeHint}
                error={form.errors.canonicalCode}
                required
                showLabel
              >
                <Input
                  size="md"
                  dir="ltr"
                  value={form.values.canonicalCode}
                  onChange={(event) =>
                    form.change(
                      { canonicalCode: event.target.value.toUpperCase() },
                      "canonicalCode",
                    )
                  }
                  maxLength={ITEM_CODE_MAX_LENGTH}
                  disabled={props.isSubmitting}
                  required
                  autoFocus
                />
              </Field>

              <Field
                label={t.trade.itemBaseUom}
                hint={uomHint}
                error={form.errors.baseUomId}
                required
                showLabel
              >
                <Combobox
                  size="md"
                  value={form.values.baseUomId || undefined}
                  selectedLabel={selectedUom ? uomLabel(selectedUom) : undefined}
                  onValueChange={(baseUomId) => form.change({ baseUomId: baseUomId ?? "" }, "baseUomId")}
                  options={form.uoms.options.map((uom) => ({
                    value: uom.id,
                    label: uomLabel(uom),
                    description: uom.localizedNames[lang] !== uom.displayName
                      ? uom.localizedNames[lang]
                      : undefined,
                  }))}
                  onSearch={form.uoms.search}
                  debounceMs={0}
                  loading={form.uoms.isLoading}
                  disabled={props.isSubmitting || form.uoms.isUnavailable}
                  placeholder={t.trade.itemBaseUomPlaceholder}
                  searchPlaceholder={t.trade.itemBaseUomSearchPlaceholder}
                  loadingLabel={t.trade.itemBaseUomLoading}
                  emptyLabel={t.trade.itemBaseUomEmpty}
                />
              </Field>
            </div>

            <fieldset className="grid gap-2">
              <legend className="sr-only">
                {t.trade.itemNamesTitle} · {t.trade.itemNamesRequirement}
              </legend>
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-sm font-medium text-foreground">
                  {t.trade.itemNamesTitle}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  · {t.trade.itemNamesRequirement}
                </span>
                <span className="h-px min-w-4 flex-1 bg-border" aria-hidden="true" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t.trade.nameEn}
                  error={form.errors.localizedNames}
                  showLabel
                >
                  <Input
                    size="md"
                    dir="ltr"
                    value={form.values.nameEn}
                    onChange={(event) =>
                      form.change({ nameEn: event.target.value }, "localizedNames")
                    }
                    maxLength={ITEM_LOCALIZED_NAME_MAX_LENGTH}
                    disabled={props.isSubmitting}
                  />
                </Field>
                <Field label={t.trade.nameAr} showLabel>
                  <Input
                    size="md"
                    dir="rtl"
                    value={form.values.nameAr}
                    onChange={(event) =>
                      form.change({ nameAr: event.target.value }, "localizedNames")
                    }
                    maxLength={ITEM_LOCALIZED_NAME_MAX_LENGTH}
                    disabled={props.isSubmitting}
                  />
                </Field>
              </div>
            </fieldset>
          </div>
        </div>

        <CategoryPicker value={form.values.category} enabled={props.isOpen}
          onChange={(category) => form.change({ category }, "categoryId")}
          disabled={props.isSubmitting} error={form.errors.categoryId} />

        <Collapsible
          open={form.advancedOpen}
          onOpenChange={form.setAdvancedOpen}
          className="overflow-hidden rounded-md border border-border bg-card"
        >
          <CollapsibleTrigger className="min-h-11 w-full justify-between rounded-none px-4 py-2.5 text-start hover:bg-muted/40">
            <span className="flex items-center gap-2">
              <ChevronDown
                className={form.advancedOpen ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-foreground">{t.trade.itemAdvancedDetails}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t.trade.itemOptional}
              </span>
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-4 border-t border-border p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <div className="grid gap-2">
                <h3 className="text-sm font-medium text-foreground">
                  {t.trade.itemVariantAttributes}
                </h3>
                {form.variantMode === "builder" ? (
                  <>
                    {form.variantRows.length > 0 ? (
                      <div className="grid gap-2">
                        {form.variantRows.map((row, index) => (
                          <div
                            key={row.id}
                            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                          >
                            <Field label={`${t.trade.itemAttributeName} ${index + 1}`}>
                              <Input
                                size="md"
                                value={row.name}
                                onChange={(event) =>
                                  form.updateVariantRow(row.id, { name: event.target.value })
                                }
                                disabled={props.isSubmitting}
                                placeholder={t.trade.itemAttributeName}
                              />
                            </Field>
                            <Field label={`${t.trade.itemAttributeValue} ${index + 1}`}>
                              <Input
                                size="md"
                                value={row.value}
                                onChange={(event) =>
                                  form.updateVariantRow(row.id, { value: event.target.value })
                                }
                                disabled={props.isSubmitting}
                                placeholder={t.trade.itemAttributeValue}
                              />
                            </Field>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="md"
                                  className="justify-self-end text-destructive sm:self-end"
                                  onClick={() => form.removeVariantRow(row.id)}
                                  disabled={props.isSubmitting}
                                  aria-label={t.trade.itemRemoveAttribute}
                                >
                                  <Trash2 className="size-4" aria-hidden="true" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t.trade.itemRemoveAttribute}</TooltipContent>
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {form.errors.variantIdentity ? (
                      <p role="alert" className="text-xs text-destructive">
                        {form.errors.variantIdentity}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={form.addVariantRow}
                        disabled={props.isSubmitting}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        {t.trade.itemAddAttribute}
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={form.showJsonEditor}
                        disabled={props.isSubmitting}
                      >
                        {t.trade.itemEditJson}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Field
                      label={t.trade.itemVariantIdentity}
                      error={form.errors.variantIdentity}
                    >
                      <Textarea
                        rows={5}
                        dir="ltr"
                        className="font-mono"
                        value={form.values.variantIdentity}
                        onChange={(event) =>
                          form.change(
                            { variantIdentity: event.target.value },
                            "variantIdentity",
                          )
                        }
                        disabled={props.isSubmitting}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="justify-self-start"
                      onClick={form.showBuilder}
                      disabled={props.isSubmitting}
                    >
                      {t.trade.itemEditBuilder}
                    </Button>
                  </>
                )}
                <p className="text-xs text-muted-foreground">{t.trade.itemVariantStored}</p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <ItemRelationsFields
          values={form.values}
          disabled={props.isSubmitting}
          enabled={props.isOpen}
          comboError={form.errors.comboComponents}
          optionalProductsError={form.errors.optionalProducts}
          onChange={(patch) => form.change(patch)}
        />

        <ItemExtendedFields
          values={form.values}
          disabled={props.isSubmitting}
          enabled={props.isOpen}
          errors={{
            barcode: form.errors.barcode,
            notes: form.errors.notes,
            ownerUserId: form.errors.ownerUserId,
            weightKg: form.errors.weightKg,
            volumeM3: form.errors.volumeM3,
            descriptions: form.errors.descriptions,
          }}
          onChange={(patch) => form.change(patch)}
        />
      </div>
    </FormModal>
  );
}
