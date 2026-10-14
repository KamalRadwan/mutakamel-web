"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  EMPTY_ITEM_FORM,
  validateCreateItemForm,
  type CreateItemFormIssues,
  type ItemFormValues,
  type ItemKind,
} from "../item-contract";
import { useActiveUoms } from "./useActiveUoms";

export interface VariantAttributeRow {
  id: string;
  name: string;
  value: string;
}

type FieldErrors = Partial<Record<keyof CreateItemFormIssues, string>>;
type VariantEditorMode = "builder" | "json";

interface UseCreateItemFormOptions {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ItemFormValues) => Promise<boolean>;
}

export function useCreateItemForm({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}: UseCreateItemFormOptions) {
  const { t } = useI18n();
  const [values, setValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [variantMode, setVariantMode] = useState<VariantEditorMode>("builder");
  const [variantRows, setVariantRows] = useState<VariantAttributeRow[]>([]);
  const [nextRowId, setNextRowId] = useState(1);
  const uoms = useActiveUoms(isOpen);

  const reset = () => {
    setValues(EMPTY_ITEM_FORM);
    setErrors({});
    setAdvancedOpen(true);
    setVariantMode("builder");
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

  const setItemKind = (itemKind: ItemKind) =>
    change(
      itemKind === "COMBO" ? { itemKind } : { itemKind, comboComponents: [] },
      "comboComponents",
    );

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

  const showJsonEditor = () => {
    setVariantMode("json");
    setErrors((current) => ({ ...current, variantIdentity: undefined }));
  };

  const showBuilder = () => {
    const parsed = parseBuilderRows(values.variantIdentity, nextRowId);
    if (!parsed) {
      setErrors((current) => ({
        ...current,
        variantIdentity: t.trade.itemVariantBuilderUnsupported,
      }));
      return;
    }
    setVariantRows(parsed.rows);
    setNextRowId(parsed.nextRowId);
    setVariantMode("builder");
    setErrors((current) => ({ ...current, variantIdentity: undefined }));
  };

  const submit = async () => {
    const issues = validateCreateItemForm(values);
    const translated = translateIssues(issues, t);
    if (variantMode === "builder" && serializeVariantRows(variantRows).invalid) {
      translated.variantIdentity = t.trade.itemVariantBuilderInvalid;
    }
    setErrors(translated);
    if (Object.values(translated).some(Boolean)) return;

    const saved = await onSubmit(values);
    if (saved) reset();
  };

  return {
    values,
    errors,
    advancedOpen,
    setAdvancedOpen,
    variantMode,
    variantRows,
    uoms,
    isDirty:
      JSON.stringify(values) !== JSON.stringify(EMPTY_ITEM_FORM) || variantRows.length > 0,
    isSubmitting,
    change,
    setItemKind,
    addVariantRow,
    updateVariantRow,
    removeVariantRow,
    showJsonEditor,
    showBuilder,
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

function serializeVariantRows(rows: VariantAttributeRow[]): { json: string; invalid: boolean } {
  const identity: Record<string, string> = {};
  let invalid = false;
  for (const row of rows) {
    const name = row.name.trim();
    const value = row.value.trim();
    if (!name && !value) continue;
    if (!name || Object.hasOwn(identity, name)) {
      invalid = true;
      continue;
    }
    identity[name] = value;
  }
  return {
    json: Object.keys(identity).length > 0 ? JSON.stringify(identity, null, 2) : "",
    invalid,
  };
}

function parseBuilderRows(
  raw: string,
  firstId: number,
): { rows: VariantAttributeRow[]; nextRowId: number } | null {
  if (!raw.trim()) return { rows: [], nextRowId: firstId };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed);
    if (entries.some(([, value]) => typeof value !== "string")) return null;
    return {
      rows: entries.map(([name, value], index) => ({
        id: `attribute-${firstId + index}`,
        name,
        value: value as string,
      })),
      nextRowId: firstId + entries.length,
    };
  } catch {
    return null;
  }
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
