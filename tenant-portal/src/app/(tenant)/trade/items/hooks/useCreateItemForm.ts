"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  EMPTY_ITEM_FORM,
  serializeVariantRows,
  validateCreateItemForm,
  type CreateItemFormIssues,
  type ItemFormValues,
  type ItemKind,
  type VariantAttributeRow,
} from "../item-contract";
import { useActiveUoms } from "./useActiveUoms";
import { useItemImageFile } from "./useItemImageFile";

export type { VariantAttributeRow };

type FieldErrors = Partial<Record<keyof CreateItemFormIssues, string>>;

interface UseCreateItemFormOptions {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  /** `image` is uploaded after the Item is created (LLD 02b §19 create flow). */
  onSubmit: (values: ItemFormValues, image: File | null) => Promise<boolean>;
  imageUpload: { retry: (image: File) => Promise<boolean> };
}

export function useCreateItemForm({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
  imageUpload,
}: UseCreateItemFormOptions) {
  const { t } = useI18n();
  const [values, setValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [variantRows, setVariantRows] = useState<VariantAttributeRow[]>([]);
  const [nextRowId, setNextRowId] = useState(1);
  const uoms = useActiveUoms(isOpen);
  const image = useItemImageFile();

  const reset = () => {
    image.clear();
    setValues(EMPTY_ITEM_FORM);
    setErrors({});
    setAdvancedOpen(true);
    setVariantRows([]);
    setNextRowId(1);
  };

  const change = (patch: Partial<ItemFormValues>, clear?: keyof FieldErrors) => {
    setValues((current) => ({ ...current, ...patch }));
    const changedErrors = issueKeysForPatch(patch);
    if (clear) changedErrors.add(clear);
    if (changedErrors.size > 0) {
      setErrors((current) => {
        const next = { ...current };
        for (const key of changedErrors) next[key] = undefined;
        return next;
      });
    }
  };

  const setItemKind = (itemKind: ItemKind) => {
    if (itemKind === "COMBO") {
      change({ itemKind }, "comboComponents");
      return;
    }
    if (itemKind === "SERVICE") {
      change(
        { itemKind, comboComponents: [], weightKg: "", volumeM3: "" },
        "comboComponents",
      );
      return;
    }
    change({ itemKind, comboComponents: [] }, "comboComponents");
  };

  const addVariantRow = () => {
    setVariantRows((current) => [
      ...current,
      { id: `attribute-${nextRowId}`, name: "", value: "" },
    ]);
    setNextRowId((current) => current + 1);
  };

  const updateVariantRows = (nextRows: VariantAttributeRow[]) => {
    setVariantRows(nextRows);
    const result = serializeVariantRows(nextRows);
    change({ variantIdentity: result.json }, "variantIdentity");
    if (result.invalid) {
      setErrors((current) => ({
        ...current,
        variantIdentity: t.trade.itemVariantBuilderInvalid,
      }));
    }
  };

  const updateVariantRow = (
    rowId: string,
    patch: Partial<Pick<VariantAttributeRow, "name" | "value">>,
  ) => {
    updateVariantRows(
      variantRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const removeVariantRow = (rowId: string) => {
    updateVariantRows(variantRows.filter((row) => row.id !== rowId));
  };

  const submit = async () => {
    const serialized = serializeVariantRows(variantRows);
    const nextValues: ItemFormValues = {
      ...values,
      variantIdentity: serialized.json,
    };
    const issues = validateCreateItemForm(nextValues);
    const translated = translateIssues(issues, t);
    if (serialized.invalid) {
      translated.variantIdentity = t.trade.itemVariantBuilderInvalid;
    }
    setErrors(translated);
    if (Object.values(translated).some(Boolean)) return;

    const saved = await onSubmit(nextValues, image.pending?.file ?? null);
    if (saved) reset();
  };

  // The Item already exists here: only the image is sent again, to it.
  const retryImage = async () => {
    if (!image.pending) return;
    if (await imageUpload.retry(image.pending.file)) reset();
  };

  const basicErrorsCount = [
    errors.canonicalCode,
    errors.baseUomId,
    errors.categoryId,
    errors.localizedNames,
  ].filter(Boolean).length;

  const hasErrors = Object.values(errors).some(Boolean);

  const isBasicDetailsComplete =
    Boolean(values.canonicalCode.trim()) &&
    Boolean(values.baseUomId.trim()) &&
    Boolean(values.nameEn.trim() || values.nameAr.trim()) &&
    values.category.kind !== "unresolved" &&
    basicErrorsCount === 0;

  const isReadyToCreate =
    isBasicDetailsComplete &&
    !hasErrors &&
    (values.itemKind !== "COMBO" ||
      (values.comboComponents.length > 0 &&
        values.comboComponents.every(
          (component) => Boolean(component.itemId.trim()) && Number(component.quantity) > 0,
        )));

  const populatedVariantCount = variantRows.filter(
    (row) => row.name.trim().length > 0 || row.value.trim().length > 0,
  ).length;

  return {
    values,
    errors,
    hasErrors,
    basicErrorsCount,
    isBasicDetailsComplete,
    isReadyToCreate,
    populatedVariantCount,
    advancedOpen,
    setAdvancedOpen,
    variantRows,
    uoms,
    isDirty:
      JSON.stringify(values) !== JSON.stringify(EMPTY_ITEM_FORM) ||
      variantRows.length > 0 ||
      image.pending !== null,
    image,
    retryImage,
    isSubmitting,
    change,
    setItemKind,
    addVariantRow,
    updateVariantRow,
    removeVariantRow,
    submit,
    onOpenChange: (open: boolean) => {
      if (!open) {
        reset();
        onClose();
      }
    },
  };
}

function issueKeysForPatch(patch: Partial<ItemFormValues>): Set<keyof CreateItemFormIssues> {
  const keys = new Set<keyof CreateItemFormIssues>();
  const changed = new Set(Object.keys(patch) as Array<keyof ItemFormValues>);
  if (changed.has("canonicalCode")) keys.add("canonicalCode");
  if (changed.has("nameAr") || changed.has("nameEn")) keys.add("localizedNames");
  if (changed.has("baseUomId")) keys.add("baseUomId");
  if (changed.has("category")) keys.add("categoryId");
  if (changed.has("variantIdentity")) keys.add("variantIdentity");
  if (changed.has("barcode")) keys.add("barcode");
  if (changed.has("notes")) keys.add("notes");
  if (changed.has("ownerUserId")) keys.add("ownerUserId");
  if (changed.has("weightKg")) keys.add("weightKg");
  if (changed.has("volumeM3")) keys.add("volumeM3");
  if (
    changed.has("quotationDescription") ||
    changed.has("salesOrderDescription") ||
    changed.has("receiptDescription") ||
    changed.has("deliveryOrderDescription")
  ) {
    keys.add("descriptions");
  }
  if (changed.has("comboComponents") || changed.has("itemKind")) keys.add("comboComponents");
  if (changed.has("optionalProducts")) keys.add("optionalProducts");
  return keys;
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function translateIssues(issues: CreateItemFormIssues, t: Dictionary): FieldErrors {
  return {
    canonicalCode: issues.canonicalCode ? t.trade.itemFormCode : undefined,
    localizedNames: issues.localizedNames ? t.trade.itemFormNames : undefined,
    baseUomId: issues.baseUomId ? t.trade.itemFormUom : undefined,
    categoryId: issues.categoryId ? t.trade.itemFormCategory : undefined,
    variantIdentity: issues.variantIdentity ? t.trade.itemFormVariant : undefined,
    barcode: issues.barcode ? t.trade.itemFormBarcode : undefined,
    notes: issues.notes ? t.trade.itemFormNotes : undefined,
    ownerUserId: issues.ownerUserId ? t.trade.itemFormOwner : undefined,
    weightKg: issues.weightKg ? t.trade.itemFormPositiveDecimal : undefined,
    volumeM3: issues.volumeM3 ? t.trade.itemFormPositiveDecimal : undefined,
    descriptions: issues.descriptions ? t.trade.itemFormDescription : undefined,
    comboComponents: issues.comboComponents ? t.trade.itemFormComboComponents : undefined,
    optionalProducts: issues.optionalProducts ? t.trade.itemFormOptionalProducts : undefined,
  };
}
