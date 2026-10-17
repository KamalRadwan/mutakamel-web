"use client";

import {
  AlertCircle,
  Boxes,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Info,
  Package,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Combobox,
  Field,
  FormModal,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  ITEM_CODE_MAX_LENGTH,
  ITEM_LOCALIZED_NAME_MAX_LENGTH,
  type ItemFormValues,
  type ItemKind,
} from "../item-contract";
import { useCreateItemForm } from "../hooks/useCreateItemForm";
import { CreateItemImageTile } from "./CreateItemImageTile";
import { ItemExtendedFields } from "./ItemExtendedFields";
import { ItemRelationsFields } from "./ItemRelationsFields";
import { CategoryPicker } from "../../categories/components/CategoryPicker";

interface CreateItemModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  /** `image` is uploaded only after the Item is created. */
  onSubmit: (values: ItemFormValues, image: File | null) => Promise<boolean>;
  /** The image upload that follows creation, and its retry. */
  imageUpload: {
    failed: boolean;
    canRetry: boolean;
    isUploading: boolean;
    error: string | null;
    status: string;
    retry: (image: File) => Promise<boolean>;
  };
}

export function CreateItemModal(props: CreateItemModalProps) {
  const { t, lang } = useI18n();
  const form = useCreateItemForm(props);
  const kind = form.values.itemKind;
  const hasModalError = form.hasErrors || Boolean(props.error);
  // LLD 02b §19: the Item is saved and only its image failed. The form is
  // locked, the primary action retries the upload to that Item, and closing
  // keeps the Item and drops the picked file.
  const savedWithoutImage = props.imageUpload.failed;
  const isBusy = props.isSubmitting || props.imageUpload.isUploading;
  const isLocked = isBusy || savedWithoutImage;

  const ItemIcon =
    kind === "PRODUCT"
      ? Package
      : kind === "SERVICE"
        ? BriefcaseBusiness
        : Boxes;

  const kindPalette =
    kind === "PRODUCT"
      ? SWATCH_SURFACE_PALETTES.blue
      : kind === "SERVICE"
        ? SWATCH_SURFACE_PALETTES.purple
        : SWATCH_SURFACE_PALETTES.orange;

  const activePalette = hasModalError ? SWATCH_SURFACE_PALETTES.red : kindPalette;

  const basicSectionTitle =
    kind === "SERVICE"
      ? t.trade.itemBasicServiceDetails
      : kind === "COMBO"
        ? t.trade.itemBasicComboDetails
        : t.trade.itemBasicDetails;

  const uomHint = form.uoms.isLoading
    ? t.trade.itemBaseUomLoading
    : form.uoms.isUnavailable
      ? t.trade.itemBaseUomUnavailable
      : t.trade.itemBaseUomHint;

  const selectedUom = form.uoms.all.find((uom) => uom.id === form.values.baseUomId);
  const uomLabel = (uom: { code: string; displayName: string }) =>
    `${uom.code} — ${uom.displayName}`;

  const headerTitleBadge = hasModalError ? (
    <Badge tone="negative">{t.trade.itemFixErrorsBadge}</Badge>
  ) : form.isReadyToCreate ? (
    <Badge tone="positive">
      <Check className="size-3" aria-hidden="true" />
      <span>{t.trade.itemReadyToCreateBadge}</span>
    </Badge>
  ) : kind === "SERVICE" ? (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-semibold",
        SWATCH_SURFACE_PALETTES.purple.badge,
      )}
    >
      {t.trade.itemServiceHeaderBadge}
    </span>
  ) : kind === "COMBO" ? (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-semibold",
        SWATCH_SURFACE_PALETTES.orange.badge,
      )}
    >
      {t.trade.itemComboHeaderBadge}
    </span>
  ) : (
    <Badge tone="brand">{t.trade.itemDraftStartBadge}</Badge>
  );

  const kindCards: Array<{
    value: ItemKind;
    title: string;
    description: string;
    icon: typeof Package;
    palette: typeof SWATCH_SURFACE_PALETTES.blue;
  }> = [
    {
      value: "PRODUCT",
      title: t.trade.itemKind_PRODUCT,
      description: t.trade.itemKindDesc_PRODUCT,
      icon: Package,
      palette: SWATCH_SURFACE_PALETTES.blue,
    },
    {
      value: "SERVICE",
      title: t.trade.itemKind_SERVICE,
      description: t.trade.itemKindDesc_SERVICE,
      icon: BriefcaseBusiness,
      palette: SWATCH_SURFACE_PALETTES.purple,
    },
    {
      value: "COMBO",
      title: t.trade.itemKind_COMBO,
      description: t.trade.itemKindDesc_COMBO,
      icon: Boxes,
      palette: SWATCH_SURFACE_PALETTES.orange,
    },
  ];

  return (
    <FormModal
      open={props.isOpen}
      onOpenChange={form.onOpenChange}
      title={t.trade.itemCreateTitle}
      description={t.trade.itemCreateDescription}
      size="wide"
      headerIcon={
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border",
            activePalette.iconBoxActive,
          )}
        >
          {hasModalError ? (
            <AlertCircle className="size-4.5" aria-hidden="true" />
          ) : (
            <ItemIcon className="size-4.5" aria-hidden="true" />
          )}
        </div>
      }
      titleBadge={headerTitleBadge}
      headerAside={
        <span className="text-xs text-muted-foreground">
          <span className="text-destructive" aria-hidden="true">
            *
          </span>{" "}
          {t.trade.itemRequiredFieldsNote}
        </span>
      }
      footerLeading={
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>{t.trade.itemEditDescription}</span>
        </span>
      }
      submitIcon={<Check className="size-3.5" aria-hidden="true" />}
      isDirty={savedWithoutImage ? false : form.isDirty}
      isSubmitting={isBusy}
      onSubmit={() => void (savedWithoutImage ? form.retryImage() : form.submit())}
      submitDisabled={
        savedWithoutImage && (!props.imageUpload.canRetry || form.image.pending === null)
      }
      error={(savedWithoutImage ? t.trade.itemImage.savedNoImage : props.error) ?? undefined}
      labels={{
        submit: savedWithoutImage ? t.trade.itemImage.retryUpload : t.trade.itemCreateSubmit,
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
      <div className="grid w-full gap-3.5">
        {/* 1. Rich 3-Card Item Kind Selector */}
        <fieldset className="grid gap-1.5">
          <legend className="sr-only">{t.trade.itemCreateKind}</legend>
          <ToggleGroup
            type="single"
            value={kind}
            onValueChange={(next) => {
              if (next) form.setItemKind(next as ItemKind);
            }}
            size="md"
            disabled={isLocked}
            aria-label={t.trade.itemCreateKind}
            className="grid w-full grid-cols-1 gap-3 bg-transparent p-0 sm:grid-cols-3"
          >
            {kindCards.map((card) => {
              const selected = kind === card.value;
              const CardIcon = card.icon;
              return (
                <ToggleGroupItem
                  key={card.value}
                  value={card.value}
                  aria-label={card.title}
                  className={cn(
                    "h-auto min-h-14 w-full items-center justify-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-start transition-colors",
                    selected ? card.palette.tileActive : card.palette.tileIdle,
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-md border",
                      selected ? card.palette.iconBoxActive : card.palette.iconBoxIdle,
                    )}
                  >
                    <CardIcon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {card.title}
                    </span>
                    <span className="truncate text-2xs text-muted-foreground">
                      {card.description}
                    </span>
                  </span>
                  {selected ? (
                    <span
                      className={cn(
                        "ms-auto flex size-5 shrink-0 items-center justify-center rounded-full border",
                        card.palette.iconBoxActive,
                      )}
                      aria-hidden="true"
                    >
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </fieldset>

        {/* 2. Basic Item Details Card with Compact 68x68 Avatar / Icon */}
        <section
          className={cn(
            "overflow-hidden rounded-lg border bg-card shadow-2xs",
            form.basicErrorsCount > 0 ? "border-destructive/50" : "border-border",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-3 border-b border-border px-4 py-2",
              form.basicErrorsCount > 0 ? "bg-destructive-subtle/50" : "bg-muted/30",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border",
                  form.basicErrorsCount > 0
                    ? SWATCH_SURFACE_PALETTES.red.iconBoxIdle
                    : kindPalette.iconBoxIdle,
                )}
              >
                {form.basicErrorsCount > 0 ? (
                  <AlertCircle className="size-3.5" aria-hidden="true" />
                ) : (
                  <ItemIcon className="size-3.5" aria-hidden="true" />
                )}
              </div>
              <h2 className="truncate text-sm font-semibold text-foreground">
                {basicSectionTitle}
              </h2>
            </div>

            {form.basicErrorsCount > 0 ? (
              <Badge tone="negative">
                <IdentifierText>{String(form.basicErrorsCount)}</IdentifierText>
                <span>{t.trade.itemFormHasErrors}</span>
              </Badge>
            ) : form.isBasicDetailsComplete ? (
              <Badge tone="positive">
                <Check className="size-3" aria-hidden="true" />
                <span>{t.trade.itemCompleteBadge}</span>
              </Badge>
            ) : (
              <Badge tone="brand">{t.trade.itemRequiredBadge}</Badge>
            )}
          </div>

          <div className="grid gap-3.5 p-4">
            <div className="grid gap-4 md:grid-cols-[7.5rem_minmax(0,1fr)] md:items-center">
              {/* Compact 68x68 Avatar / Icon Slot: the image picker */}
              <CreateItemImageTile
                icon={ItemIcon}
                surfaceClassName={
                  form.basicErrorsCount > 0
                    ? SWATCH_SURFACE_PALETTES.red.tileActive
                    : kindPalette.tileActive
                }
                image={form.image}
                upload={props.imageUpload}
                disabled={isBusy}
              />

              {/* Primary Identity Fields */}
              <div className="grid content-start gap-3">
                <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
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
                      className="font-mono"
                      placeholder={t.trade.itemCodePlaceholder}
                      value={form.values.canonicalCode}
                      onChange={(event) =>
                        form.change(
                          { canonicalCode: event.target.value.toUpperCase() },
                          "canonicalCode",
                        )
                      }
                      maxLength={ITEM_CODE_MAX_LENGTH}
                      disabled={isLocked}
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
                      leadingSlot={
                        selectedUom ? (
                          <Badge tone="brand">
                            <IdentifierText>{selectedUom.code}</IdentifierText>
                          </Badge>
                        ) : undefined
                      }
                      onValueChange={(baseUomId) =>
                        form.change({ baseUomId: baseUomId ?? "" }, "baseUomId")
                      }
                      options={form.uoms.options.map((uom) => ({
                        value: uom.id,
                        label: uomLabel(uom),
                        description:
                          uom.localizedNames[lang] !== uom.displayName
                            ? uom.localizedNames[lang]
                            : undefined,
                      }))}
                      onSearch={form.uoms.search}
                      debounceMs={0}
                      loading={form.uoms.isLoading}
                      disabled={isLocked || form.uoms.isUnavailable}
                      placeholder={t.trade.itemBaseUomPlaceholder}
                      searchPlaceholder={t.trade.itemBaseUomSearchPlaceholder}
                      loadingLabel={t.trade.itemBaseUomLoading}
                      emptyLabel={t.trade.itemBaseUomEmpty}
                    />
                  </Field>
                </div>

                <fieldset className="grid gap-2">
                  <legend className="sr-only">
                    {t.trade.localizedNamesTitle} · {t.trade.localizedNamesRequirement}
                  </legend>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs font-semibold text-foreground">
                      {t.trade.localizedNamesTitle}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      · {t.trade.localizedNamesRequirement}
                    </span>
                    <span className="h-px min-w-4 flex-1 bg-border" aria-hidden="true" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
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
                        disabled={isLocked}
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
                        disabled={isLocked}
                      />
                    </Field>
                  </div>
                </fieldset>
              </div>
            </div>

            <CategoryPicker
              value={form.values.category}
              enabled={props.isOpen}
              onChange={(category) => form.change({ category }, "categoryId")}
              disabled={isLocked}
              error={form.errors.categoryId}
            />
          </div>
        </section>

        {/* 3. Collapsible Variant Attributes — Strictly Key-Value Rows (Never JSON) */}
        <Collapsible
          open={form.advancedOpen || Boolean(form.errors.variantIdentity)}
          onOpenChange={form.setAdvancedOpen}
          className={cn(
            "overflow-hidden rounded-lg border bg-card shadow-2xs",
            form.errors.variantIdentity ? "border-destructive/50" : "border-border",
          )}
        >
          <CollapsibleTrigger className="min-h-11 w-full justify-between rounded-none bg-muted/25 px-4 py-2.5 text-start hover:bg-muted/45">
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border",
                  form.errors.variantIdentity
                    ? SWATCH_SURFACE_PALETTES.red.iconBoxIdle
                    : SWATCH_SURFACE_PALETTES.purple.iconBoxIdle,
                )}
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              </span>
              <span className="truncate text-sm font-semibold text-foreground">
                {t.trade.itemAdvancedDetails} · {t.trade.itemVariantAttributes}
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                {t.trade.itemVariantAttributesSubtitle}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {form.populatedVariantCount > 0 ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold",
                    SWATCH_SURFACE_PALETTES.purple.badge,
                  )}
                >
                  {formatTemplate(t.trade.itemVariantAttributesCount, {
                    count: String(form.populatedVariantCount),
                  })}
                </span>
              ) : (
                <Badge tone="neutral">{t.trade.itemOptional}</Badge>
              )}
              <ChevronDown
                className={
                  form.advancedOpen || form.errors.variantIdentity
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
                <h3 className="text-xs font-semibold text-foreground">
                  {t.trade.itemVariantAttributes}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={form.addVariantRow}
                  disabled={isLocked}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  {t.trade.itemAddAttribute}
                </Button>
              </div>

              {form.variantRows.length > 0 ? (
                <div className="grid gap-2.5">
                  {form.variantRows.map((row, index) => (
                    <div
                      key={row.id}
                      className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end"
                    >
                      <Field label={`${t.trade.itemAttributeName} ${index + 1}`} showLabel>
                        <Input
                          size="sm"
                          dir="ltr"
                          className="font-mono"
                          value={row.name}
                          onChange={(event) =>
                            form.updateVariantRow(row.id, { name: event.target.value })
                          }
                          disabled={isLocked}
                          placeholder={t.trade.itemAttributeName}
                        />
                      </Field>
                      <Field label={`${t.trade.itemAttributeValue} ${index + 1}`} showLabel>
                        <Input
                          size="sm"
                          value={row.value}
                          onChange={(event) =>
                            form.updateVariantRow(row.id, { value: event.target.value })
                          }
                          disabled={isLocked}
                          placeholder={t.trade.itemAttributeValue}
                        />
                      </Field>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="justify-self-end text-destructive sm:self-end"
                            onClick={() => form.removeVariantRow(row.id)}
                            disabled={isLocked}
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
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* 4. Combo Components & Optional Products */}
        <ItemRelationsFields
          values={form.values}
          disabled={isLocked}
          enabled={props.isOpen}
          comboError={form.errors.comboComponents}
          optionalProductsError={form.errors.optionalProducts}
          onChange={(patch) => form.change(patch)}
        />

        {/* 5. Operational Details & Default Document Descriptions */}
        <ItemExtendedFields
          values={form.values}
          disabled={isLocked}
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
