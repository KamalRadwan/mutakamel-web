"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { type PriceAdjustmentMode, type PriceBookVersionDetail, type PriceRoundingMode } from "../../pricing-contract";
import { type DraftValidationIssue, type PriceBookVersionDraft } from "../../version-draft";

export interface VersionMatrixHeaderControlsProps {
  detail: PriceBookVersionDetail;
  draft: PriceBookVersionDraft;
  editable: boolean;
  currencyDecimalPlaces?: number;
  matchingKeys: readonly string[];
  search: string;
  issues: readonly DraftValidationIssue[];
  onChangeSearch: (next: string) => void;
  onChangeDraft: (updater: (prev: PriceBookVersionDraft) => PriceBookVersionDraft) => void;
  onAddRow: () => void;
}



export function useVersionMatrixControls({
  detail,
  draft,
  editable,
  currencyDecimalPlaces,
  matchingKeys,
  search,
  issues,
  onChangeSearch,
  onChangeDraft,
  onAddRow,
}: VersionMatrixHeaderControlsProps) {
  const { t, lang } = useI18n();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<PriceAdjustmentMode>("PERCENTAGE");
  const [bulkValue, setBulkValue] = useState("5");
  const [bulkRounding, setBulkRounding] = useState<PriceRoundingMode>("NONE");

  const dateIssue = (field: string) =>
    issues.find((i) => i.tab === "details" && i.field === field);

  
  return { detail, draft, editable, currencyDecimalPlaces, matchingKeys, search, onChangeSearch, onChangeDraft, onAddRow, t, lang, bulkOpen, setBulkOpen, bulkMode, setBulkMode, bulkValue, setBulkValue, bulkRounding, setBulkRounding, dateIssue };
}
