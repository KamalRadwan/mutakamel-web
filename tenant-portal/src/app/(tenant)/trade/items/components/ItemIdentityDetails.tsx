"use client";

import { useCallback, useState } from "react";
import { Check, FileText, Lock, Package, Plus, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Combobox,
  DegradedBanner,
  Field,
  IdentifierText,
  Input,
  Textarea,
  TooltipProvider,
  useToast,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { CategoryPicker } from "../../categories/components/CategoryPicker";
import { tradeIfMatch, tradePatch } from "../../trade-api";
import {
  canPerformTradeAction,
  TRADE_CONCURRENCY_CODES,
  TRADE_PERMISSIONS,
} from "../../trade-scope";
import { useTradeWrite } from "../../useTradeWrite";
import { tradeLocalizedName } from "../../trade-validation";
import { useActiveUoms } from "../hooks/useActiveUoms";
import { useItemReferenceData } from "../hooks/useItemReferenceData";
import { useItemReferenceOptions } from "../hooks/useItemReferenceOptions";
import {
  buildUpdateItemRequest,
  formatTradeDecimal,
  isItemDecimalString,
  isItemKind,
  ITEM_BARCODE_MAX_LENGTH,
  ITEM_CODE_TAKEN_CODE,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_IDENTITY_INVALID_CODE,
  ITEM_LOCALIZED_NAME_MAX_LENGTH,
  ITEM_NOTES_MAX_LENGTH,
  ITEM_STATUSES,
  ITEM_UOM_INVALID_CODE,
  itemPath,
  parseVariantIdentityToRows,
  serializeVariantRows,
  toItemForm,
  type Item,
  type ItemFormValues,
  type ItemStatus,
  type VariantAttributeRow,
} from "../item-contract";
import { ItemRelationsFields } from "./ItemRelationsFields";

type Dictionary = ReturnType<typeof useI18n>["t"];

function formMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "ITEM_FORM_CODE") return t.trade.itemFormCode;
  if (reason === "ITEM_FORM_NAMES") return t.trade.itemFormNames;
  if (reason === "ITEM_FORM_UOM") return t.trade.itemFormUom;
  if (reason === "ITEM_FORM_CATEGORY") return t.trade.itemFormCategory;
  if (reason === "ITEM_FORM_VARIANT") return t.trade.itemFormVariant;
  if (reason === "ITEM_FORM_BARCODE") return t.trade.itemFormBarcode;
  if (reason === "ITEM_FORM_NOTES") return t.trade.itemFormNotes;
  if (reason === "ITEM_FORM_OWNER") return t.trade.itemFormOwner;
  if (reason === "ITEM_FORM_DECIMAL") return t.trade.itemFormPositiveDecimal;
  if (reason === "ITEM_FORM_DESCRIPTION") return t.trade.itemFormDescription;
  if (reason === "ITEM_FORM_COMBO") return t.trade.itemFormComboComponents;
  if (reason === "ITEM_FORM_OPTIONAL_PRODUCTS") return t.trade.itemFormOptionalProducts;
  return t.trade.itemUpdateFailed;
}

function countModifiedFields(initial: ItemFormValues, current: ItemFormValues): number {
  let count = 0;
  if (initial.nameEn !== current.nameEn) count += 1;
  if (initial.nameAr !== current.nameAr) count += 1;
  if (JSON.stringify(initial.category) !== JSON.stringify(current.category)) count += 1;
  if (initial.status !== current.status) count += 1;
  if (initial.barcode !== current.barcode) count += 1;
  if (initial.ownerUserId !== current.ownerUserId) count += 1;
  if (initial.weightKg !== current.weightKg) count += 1;
  if (initial.volumeM3 !== current.volumeM3) count += 1;
  if (initial.variantIdentity !== current.variantIdentity) count += 1;
  if (initial.notes !== current.notes) count += 1;
  if (initial.quotationDescription !== current.quotationDescription) count += 1;
  if (initial.salesOrderDescription !== current.salesOrderDescription) count += 1;
  if (initial.receiptDescription !== current.receiptDescription) count += 1;
  if (initial.deliveryOrderDescription !== current.deliveryOrderDescription) count += 1;
  if (JSON.stringify(initial.comboComponents) !== JSON.stringify(current.comboComponents)) count += 1;
  if (JSON.stringify(initial.optionalProducts) !== JSON.stringify(current.optionalProducts)) count += 1;
  return count;
}

export function ItemIdentityDetails({
  item,
  onSaved,
}: {
  item: Item;
  onSaved?: () => Promise<void> | void;
}) {
  return (
    <TooltipProvider>
      {/* Not keyed on `version`: an image change bumps it in place, and
          remounting would drop unsaved identity edits. Every reload that
          changes the identity also changes `updatedAt`. */}
      <ItemIdentityWorkspace
        key={`${item.id}-${item.updatedAt}`}
        item={item}
        onSaved={onSaved}
      />
    </TooltipProvider>
  );
}

function ItemIdentityWorkspace({
  item,
  onSaved,
}: {
  item: Item;
  onSaved?: () => Promise<void> | void;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canManageMaster = canPerformTradeAction(user, TRADE_PERMISSIONS.catalogMasterManage);

  const initial = toItemForm(item);
  const initialVariantParsed = parseVariantIdentityToRows(initial.variantIdentity, 1);
  const [values, setValues] = useState<ItemFormValues>(initial);
  const [variantRows, setVariantRows] = useState<VariantAttributeRow[]>(
    initialVariantParsed.rows,
  );
  const [nextRowId, setNextRowId] = useState<number>(initialVariantParsed.nextRowId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reference = useItemReferenceData(canManageMaster || Boolean(item.ownerUserId));
  const { options: activeUoms, all: allUoms } = useActiveUoms(true, item.baseUomId);
  const resolvedBaseUom = (allUoms ?? activeUoms).find((uom) => uom.id === item.baseUomId);
  const resolvedBaseUomName = resolvedBaseUom
    ? tradeLocalizedName(resolvedBaseUom.localizedNames, lang) || resolvedBaseUom.displayName
    : null;

  const relatedIds = [
    ...item.comboComponents.map((component) => component.componentItemId),
    ...item.optionalProducts.map((product) => product.optionalProductItemId),
  ];
  const related = useItemReferenceOptions(relatedIds.length > 0, relatedIds, item.id);
  const selectedOwner = reference.owners.find((owner) => owner.id === values.ownerUserId);

  const modifiedCount = countModifiedFields(initial, values);
  const isDirty = modifiedCount > 0;

  const change = (patch: Partial<ItemFormValues>) => {
    setFormError(null);
    setValues((current) => ({ ...current, ...patch }));
  };

  const syncVariantRows = (nextRows: VariantAttributeRow[]) => {
    setVariantRows(nextRows);
    const serialized = serializeVariantRows(nextRows);
    change({
      variantIdentity: serialized.invalid ? "{invalid}" : serialized.json,
    });
  };

  const addVariantRow = () => {
    setVariantRows((current) => [
      ...current,
      { id: `attribute-${nextRowId}`, name: "", value: "" },
    ]);
    setNextRowId((current) => current + 1);
  };

  const describe = useCallback(
    (error: NormalizedApiError): string | undefined => {
      if (error.code === ITEM_CODE_TAKEN_CODE) return t.trade.itemCodeTaken;
      if (error.code === ITEM_IDENTITY_INVALID_CODE) return t.trade.itemIdentityInvalid;
      if (error.code === ITEM_UOM_INVALID_CODE) return t.trade.itemUomInvalid;
      return undefined;
    },
    [t],
  );

  const handleSave = async () => {
    if (!canManageMaster || isSubmitting) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const request = buildUpdateItemRequest(item, values);
      if (Object.keys(request).length === 0) {
        return;
      }
      const outcome = await runWrite(
        () =>
          tradePatch(itemPath(item.id), request, {
            headers: { "if-match": tradeIfMatch(item.version) },
          }),
        { failureTitle: t.trade.itemUpdateFailed, describe },
      );
      if (!outcome.ok) {
        if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) {
          await onSaved?.();
        }
        return;
      }
      toast.success(
        t.trade.savedTitle,
        outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
      );
      await onSaved?.();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("ITEM_FORM_")) {
        setFormError(formMessage(error, t));
      } else {
        toast.errorFromApi(t.trade.itemUpdateFailed, normalizeApiError(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscard = () => {
    setFormError(null);
    setValues(initial);
    const resetParsed = parseVariantIdentityToRows(initial.variantIdentity, 1);
    setVariantRows(resetParsed.rows);
    setNextRowId(resetParsed.nextRowId);
  };

  const variantEntries = variantRows
    .map((row) => [row.name.trim(), row.value.trim()] as const)
    .filter(([key, val]) => Boolean(key) && Boolean(val));

  const filledDocDescriptionsCount = [
    values.quotationDescription.trim(),
    values.salesOrderDescription.trim(),
    values.receiptDescription.trim(),
    values.deliveryOrderDescription.trim(),
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Interactive 4-Segment Lifecycle Status Stage Bar + Inline Save Bar */}
      <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
        <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4 rtl:divide-x-reverse">
          {ITEM_STATUSES.map((statusOption) => {
            const active = values.status === statusOption;
            const toneClasses = active
              ? statusOption === "ACTIVE"
                ? "border-t-2 border-t-primary bg-primary text-primary-foreground font-semibold"
                : statusOption === "DISCONTINUED"
                  ? "border-t-2 border-t-destructive bg-destructive-subtle text-destructive-subtle-foreground font-semibold"
                  : statusOption === "INACTIVE"
                    ? "border-t-2 border-t-border bg-warning-subtle text-warning-subtle-foreground font-semibold"
                    : "border-t-2 border-t-primary bg-info-subtle text-info-subtle-foreground font-semibold"
              : "border-t-2 border-t-transparent bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground";

            return (
              <Button
                key={statusOption}
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canManageMaster || isSubmitting}
                onClick={() => change({ status: statusOption as ItemStatus })}
                className={`justify-center gap-1.5 rounded-none px-3 py-2 text-xs font-semibold transition-colors ${toneClasses}`}
              >
                {active ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
                <span>{t.trade[`itemStatus_${statusOption}`]}</span>
              </Button>
            );
          })}
        </div>

        {isDirty ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-warning-subtle px-3.5 py-2 text-xs text-warning-subtle-foreground">
            <div className="flex items-center gap-2 font-semibold">
              <Badge tone="caution">
                <IdentifierText>{String(modifiedCount)}</IdentifierText>
              </Badge>
              <span>{t.trade.itemEditDescription}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleDiscard}
                disabled={isSubmitting}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {t.common.cancel}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="xs"
                onClick={() => void handleSave()}
                disabled={isSubmitting}
              >
                <Check className="size-3.5" aria-hidden />
                {t.trade.save}
              </Button>
            </div>
          </div>
        ) : null}

        {formError ? (
          <div
            role="alert"
            className="border-t border-border bg-destructive-subtle px-3.5 py-2 text-xs font-medium text-destructive-subtle-foreground"
          >
            {formError}
          </div>
        ) : null}
      </div>

      {/* Card 1: Core Identity, Classification & Ownership */}
      <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-info-subtle text-info-subtle-foreground">
              <Package className="size-3.5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xs font-semibold tracking-tight text-foreground">
                1. {t.trade.itemDetailTitle}
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {t.trade.itemEditDescription}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge tone={canManageMaster ? "positive" : "neutral"}>
              {canManageMaster ? t.trade.itemEditTitle : t.common.status}
            </Badge>
            <Badge tone="brand">
              {isItemKind(item.itemKind) ? t.trade[`itemKind_${item.itemKind}`] : item.itemKind}
            </Badge>
            <Badge tone="neutral">
              <IdentifierText>{`v${item.version}`}</IdentifierText>
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3.5 p-4">
          {/* Row 1: 3 Immutable Identity Tiles on the Same Horizontal Line */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-start">
            <div className="flex flex-col gap-1.5">
              <div className="flex min-h-4 items-center justify-between gap-1 text-xs">
                <span className="font-medium text-foreground">{t.trade.itemCode}</span>
                <Lock className="size-3 text-muted-foreground" aria-hidden />
              </div>
              <div className="flex h-(--size-control-sm) items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 text-xs font-semibold text-foreground">
                <IdentifierText>{item.canonicalCode}</IdentifierText>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex min-h-4 items-center justify-between gap-1 text-xs">
                <span className="font-medium text-foreground">{t.trade.itemKind}</span>
                <Lock className="size-3 text-muted-foreground" aria-hidden />
              </div>
              <div className="flex h-(--size-control-sm) items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 text-xs font-semibold text-foreground">
                <span>
                  {isItemKind(item.itemKind) ? t.trade[`itemKind_${item.itemKind}`] : item.itemKind}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex min-h-4 items-center justify-between gap-1 text-xs">
                <span className="font-medium text-foreground">{t.trade.itemBaseUom}</span>
                <Lock className="size-3 text-muted-foreground" aria-hidden />
              </div>
              <div className="flex h-(--size-control-sm) items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 text-xs font-semibold text-foreground">
                {resolvedBaseUom ? (
                  <>
                    <Badge tone="positive">
                      <IdentifierText>{resolvedBaseUom.code}</IdentifierText>
                    </Badge>
                    <span className="truncate">{resolvedBaseUomName}</span>
                  </>
                ) : (
                  <IdentifierText className="truncate text-xs">{item.baseUomId}</IdentifierText>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Editable Localized Names on the Same Horizontal Line */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
            <Field
              label={t.trade.nameEn}
              required
              showLabel
              readOnly={!canManageMaster}
            >
              <Input
                size="sm"
                dir="ltr"
                placeholder={t.trade.nameEn}
                value={values.nameEn}
                onChange={(event) => change({ nameEn: event.target.value })}
                maxLength={ITEM_LOCALIZED_NAME_MAX_LENGTH}
                disabled={isSubmitting}
                readOnly={!canManageMaster}
              />
            </Field>

            <Field
              label={t.trade.nameAr}
              showLabel
              hint={t.trade.localizedNamesHint}
              hintPlacement="tooltip"
              readOnly={!canManageMaster}
            >
              <Input
                size="sm"
                dir="rtl"
                placeholder={t.trade.nameAr}
                value={values.nameAr}
                onChange={(event) => change({ nameAr: event.target.value })}
                maxLength={ITEM_LOCALIZED_NAME_MAX_LENGTH}
                disabled={isSubmitting}
                readOnly={!canManageMaster}
              />
            </Field>
          </div>

          {/* Row 3: Category, Owner & Barcode on the Same Horizontal Line */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-start">
            {canManageMaster ? (
              <CategoryPicker
                compact
                value={values.category}
                currentSummary={item.categorySummary}
                onChange={(category) => change({ category })}
                disabled={isSubmitting}
              />
            ) : (
              <Field label={t.trade.itemCategory} showLabel readOnly>
                <div className="flex h-(--size-control-sm) items-center rounded-md border border-border bg-muted/40 px-2.5 text-xs text-foreground">
                  {item.categorySummary ? (
                    <span className="truncate">
                      {item.categorySummary.path.map((segment) => segment.name).join(" / ")}
                    </span>
                  ) : (
                    t.trade.categories.none
                  )}
                </div>
              </Field>
            )}

            {canManageMaster ? (
              <Field label={t.trade.itemOwner} showLabel>
                <Combobox
                  value={values.ownerUserId || undefined}
                  selectedLabel={selectedOwner?.name ?? (values.ownerUserId || undefined)}
                  onValueChange={(next) => change({ ownerUserId: next ?? "" })}
                  options={reference.owners.map((owner) => ({
                    value: owner.id,
                    label: owner.name,
                  }))}
                  onSearch={reference.search}
                  loading={reference.isLoading}
                  disabled={isSubmitting}
                  size="sm"
                  placeholder={t.trade.itemOwnerPlaceholder}
                  searchPlaceholder={t.trade.itemSearchOwners}
                  loadingLabel={t.common.loading}
                  emptyLabel={t.trade.itemNoOwnerResults}
                  clearLabel={t.trade.itemNoOwner}
                />
              </Field>
            ) : (
              <Field label={t.trade.itemOwner} showLabel readOnly>
                <div className="flex h-(--size-control-sm) items-center rounded-md border border-border bg-muted/40 px-2.5 text-xs text-foreground">
                  {selectedOwner?.name ??
                    (item.ownerUserId ? (
                      <IdentifierText className="truncate text-xs">{item.ownerUserId}</IdentifierText>
                    ) : (
                      "—"
                    ))}
                </div>
              </Field>
            )}

            <Field label={t.trade.itemBarcode} showLabel readOnly={!canManageMaster}>
              <Input
                size="sm"
                dir="ltr"
                className="font-mono"
                placeholder={t.trade.itemBarcode}
                value={values.barcode}
                onChange={(event) => change({ barcode: event.target.value })}
                maxLength={ITEM_BARCODE_MAX_LENGTH}
                disabled={isSubmitting}
                readOnly={!canManageMaster}
              />
            </Field>
          </div>

          {reference.error ? <DegradedBanner message={t.trade.itemReferenceDataUnavailable} /> : null}
        </div>
      </section>

      {/* Card 2: Logistics Dimensions, Variant Identity & Operational Notes */}
      <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-warning-subtle text-warning-subtle-foreground">
              <SlidersHorizontal className="size-3.5" aria-hidden />
            </div>
            <h2 className="truncate text-xs font-semibold tracking-tight text-foreground">
              2. {t.trade.itemWeightKg}, {t.trade.itemVolumeM3} & {t.trade.itemVariantIdentity}
            </h2>
          </div>

          {variantEntries.length > 0 ? (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {variantEntries.map(([key, val]) => (
                <Badge key={key} tone="brand">
                  <IdentifierText>{`${key}: ${String(val)}`}</IdentifierText>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3.5 p-4">
          {/* Row 1: Weight & Volume */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
            <Field
              label={t.trade.itemWeightKg}
              showLabel
              hint={
                item.itemKind === "SERVICE"
                  ? t.trade.itemServiceWeightVolumeDisabledHint
                  : t.trade.itemPositiveDecimal
              }
              hintPlacement="tooltip"
              readOnly={!canManageMaster || item.itemKind === "SERVICE"}
            >
              <Input
                size="sm"
                dir="ltr"
                className="font-mono tabular-nums"
                placeholder={item.itemKind === "SERVICE" ? "—" : "0.00"}
                inputMode="decimal"
                value={values.weightKg}
                onChange={(event) => change({ weightKg: event.target.value })}
                onBlur={() => {
                  if (values.weightKg.trim() && isItemDecimalString(values.weightKg.trim())) {
                    change({ weightKg: formatTradeDecimal(values.weightKg) });
                  }
                }}
                disabled={isSubmitting || item.itemKind === "SERVICE"}
                readOnly={!canManageMaster}
              />
            </Field>

            <Field
              label={t.trade.itemVolumeM3}
              showLabel
              hint={
                item.itemKind === "SERVICE"
                  ? t.trade.itemServiceWeightVolumeDisabledHint
                  : t.trade.itemPositiveDecimal
              }
              hintPlacement="tooltip"
              readOnly={!canManageMaster || item.itemKind === "SERVICE"}
            >
              <Input
                size="sm"
                dir="ltr"
                className="font-mono tabular-nums"
                placeholder={item.itemKind === "SERVICE" ? "—" : "0.00"}
                inputMode="decimal"
                value={values.volumeM3}
                onChange={(event) => change({ volumeM3: event.target.value })}
                onBlur={() => {
                  if (values.volumeM3.trim() && isItemDecimalString(values.volumeM3.trim())) {
                    change({ volumeM3: formatTradeDecimal(values.volumeM3) });
                  }
                }}
                disabled={isSubmitting || item.itemKind === "SERVICE"}
                readOnly={!canManageMaster}
              />
            </Field>
          </div>

          {/* Row 2: Variant Attributes (Always Key-Value, never raw JSON) */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {t.trade.itemVariantAttributes}
                </span>
                <Badge tone={variantEntries.length > 0 ? "brand" : "neutral"}>
                  <IdentifierText>{String(variantEntries.length)}</IdentifierText>
                </Badge>
              </div>
              {canManageMaster ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isSubmitting}
                  onClick={addVariantRow}
                >
                  <Plus className="size-3.5" aria-hidden />
                  {t.trade.itemAddAttribute}
                </Button>
              ) : null}
            </div>

            {variantRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.trade.itemVariantHint}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {variantRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                  >
                    <Field label={t.trade.itemAttributeName} readOnly={!canManageMaster}>
                      <Input
                        size="sm"
                        placeholder={t.trade.itemAttributeName}
                        dir="ltr"
                        className="font-mono"
                        value={row.name}
                        onChange={(event) =>
                          syncVariantRows(
                            variantRows.map((itemRow) =>
                              itemRow.id === row.id
                                ? { ...itemRow, name: event.target.value }
                                : itemRow,
                            ),
                          )
                        }
                        disabled={isSubmitting}
                        readOnly={!canManageMaster}
                      />
                    </Field>
                    <Field label={t.trade.itemAttributeValue} readOnly={!canManageMaster}>
                      <Input
                        size="sm"
                        placeholder={t.trade.itemAttributeValue}
                        value={row.value}
                        onChange={(event) =>
                          syncVariantRows(
                            variantRows.map((itemRow) =>
                              itemRow.id === row.id
                                ? { ...itemRow, value: event.target.value }
                                : itemRow,
                            ),
                          )
                        }
                        disabled={isSubmitting}
                        readOnly={!canManageMaster}
                      />
                    </Field>
                    {canManageMaster ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting}
                        aria-label={t.trade.itemRemoveAttribute}
                        onClick={() =>
                          syncVariantRows(
                            variantRows.filter((itemRow) => itemRow.id !== row.id),
                          )
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Row 3: Full-Width Internal Operational Notes */}
          <Field label={t.trade.itemNotes} showLabel readOnly={!canManageMaster}>
            <Textarea
              rows={2}
              placeholder={t.trade.itemNotes}
              value={values.notes}
              onChange={(event) => change({ notes: event.target.value })}
              maxLength={ITEM_NOTES_MAX_LENGTH}
              disabled={isSubmitting}
              readOnly={!canManageMaster}
            />
          </Field>
        </div>
      </section>

      {/* Card 3: Document Descriptions & Cross-Sell / Combo Relations */}
      <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-success-subtle text-success-subtle-foreground">
              <FileText className="size-3.5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xs font-semibold tracking-tight text-foreground">
                3. {t.trade.itemDocumentDescriptions}
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {t.trade.itemDocumentDescriptionsHint}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Badge tone={filledDocDescriptionsCount > 0 ? "brand" : "neutral"}>
              <IdentifierText>{`${filledDocDescriptionsCount} / 4`}</IdentifierText>
            </Badge>
            {values.optionalProducts.length > 0 ? (
              <Badge tone="positive">
                <IdentifierText>{String(values.optionalProducts.length)}</IdentifierText>
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3.5 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
            <Field label={t.trade.itemQuotationDescription} showLabel readOnly={!canManageMaster}>
              <Textarea
                rows={2}
                placeholder={t.trade.itemQuotationDescription}
                value={values.quotationDescription}
                onChange={(event) => change({ quotationDescription: event.target.value })}
                maxLength={ITEM_DESCRIPTION_MAX_LENGTH}
                disabled={isSubmitting}
                readOnly={!canManageMaster}
              />
            </Field>

            <Field label={t.trade.itemSalesOrderDescription} showLabel readOnly={!canManageMaster}>
              <Textarea
                rows={2}
                placeholder={t.trade.itemSalesOrderDescription}
                value={values.salesOrderDescription}
                onChange={(event) => change({ salesOrderDescription: event.target.value })}
                maxLength={ITEM_DESCRIPTION_MAX_LENGTH}
                disabled={isSubmitting}
                readOnly={!canManageMaster}
              />
            </Field>

            <Field label={t.trade.itemReceiptDescription} showLabel readOnly={!canManageMaster}>
              <Textarea
                rows={2}
                placeholder={t.trade.itemReceiptDescription}
                value={values.receiptDescription}
                onChange={(event) => change({ receiptDescription: event.target.value })}
                maxLength={ITEM_DESCRIPTION_MAX_LENGTH}
                disabled={isSubmitting}
                readOnly={!canManageMaster}
              />
            </Field>

            <Field label={t.trade.itemDeliveryDescription} showLabel readOnly={!canManageMaster}>
              <Textarea
                rows={2}
                placeholder={t.trade.itemDeliveryDescription}
                value={values.deliveryOrderDescription}
                onChange={(event) => change({ deliveryOrderDescription: event.target.value })}
                maxLength={ITEM_DESCRIPTION_MAX_LENGTH}
                disabled={isSubmitting}
                readOnly={!canManageMaster}
              />
            </Field>
          </div>

          <div className="border-t border-border/60 pt-3">
            {canManageMaster ? (
              <ItemRelationsFields
                values={values}
                disabled={isSubmitting}
                excludeItemId={item.id}
                onChange={change}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {item.itemKind === "COMBO" ? (
                  <RelationList
                    title={t.trade.itemComboComponents}
                    description={t.trade.itemComboComponentsHint}
                    emptyLabel={t.trade.itemNoComboComponents}
                    rows={item.comboComponents.map((component) => ({
                      key: `${component.componentItemId}-${component.sortOrder}`,
                      label: related.labelFor(component.componentItemId),
                      suffix: `${t.trade.itemComponentQuantity}: ${formatTradeDecimal(component.quantity)}`,
                    }))}
                  />
                ) : null}

                <RelationList
                  title={t.trade.itemOptionalProducts}
                  description={t.trade.itemOptionalProductsHint}
                  emptyLabel={t.trade.itemNoOptionalProducts}
                  rows={item.optionalProducts.map((product) => ({
                    key: `${product.optionalProductItemId}-${product.sortOrder}`,
                    label: related.labelFor(product.optionalProductItemId),
                  }))}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function RelationList({
  title,
  description,
  emptyLabel,
  rows,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  rows: Array<{ key: string; label: string; suffix?: string }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ol className="flex flex-wrap gap-2">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="flex items-center gap-1.5 rounded-md border border-border bg-info-subtle px-2.5 py-1 text-xs font-semibold text-info-subtle-foreground"
            >
              <span>#{index + 1}</span>
              <span>{row.label}</span>
              {row.suffix ? <span className="text-muted-foreground">({row.suffix})</span> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
