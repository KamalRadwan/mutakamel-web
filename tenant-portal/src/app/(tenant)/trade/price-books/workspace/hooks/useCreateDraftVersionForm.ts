"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { SIGNED_DECIMAL_16_8_PATTERN, localizedBookDisplayName, type ClonePriceBookVersionInput, type CloneSourceMode, type PriceAdjustmentMode, type PriceBook, type PriceBookDetail, type PriceRoundingMode } from "../../pricing-contract";

export interface CreateDraftVersionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: PriceBookDetail;
  books: readonly PriceBook[];
  initialSourceVersionId?: string;
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (input: ClonePriceBookVersionInput) => Promise<boolean>;
}

function defaultEffectiveFromLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function useCreateDraftVersionForm({
  open,
  onOpenChange,
  detail,
  books,
  initialSourceVersionId,
  isSubmitting,
  error,
  onSubmit,
}: CreateDraftVersionModalProps) {
  const { t, lang } = useI18n();

  const compatibleVersionOptions = useMemo(() => {
    const out: Array<{ versionId: string; label: string }> = [];
    const seen = new Set<string>();
    for (const v of detail.versions) {
      seen.add(v.id);
      out.push({
        versionId: v.id,
        label: `${detail.book.code} · v${v.versionNumber} (${tradeStatusLabel(t.tradeStatus, v.status, t.common.unknownCode)})`,
      });
    }
    for (const b of books) {
      if (b.id === detail.book.id || b.purpose !== detail.book.purpose || b.currencyCode !== detail.book.currencyCode) continue;
      for (const v of b.versions) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        out.push({ versionId: v.id, label: `${b.code} — ${localizedBookDisplayName(b, lang)} · v${v.versionNumber}` });
      }
    }
    return out;
  }, [books, detail.book, detail.versions, lang, t.common.unknownCode, t.tradeStatus]);

  const hasVersionSources = compatibleVersionOptions.length > 0;
  const defaultVersionId =
    initialSourceVersionId && compatibleVersionOptions.some((o) => o.versionId === initialSourceVersionId)
      ? initialSourceVersionId
      : (compatibleVersionOptions[0]?.versionId ?? "");

  const [sourceMode, setSourceMode] = useState<CloneSourceMode>(hasVersionSources ? "VERSION" : "CATALOG");
  const [sourceVersionId, setSourceVersionId] = useState<string>(defaultVersionId);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(defaultEffectiveFromLocal);
  const [effectiveTo, setEffectiveTo] = useState<string>("");
  const [adjustmentMode, setAdjustmentMode] = useState<PriceAdjustmentMode>("NONE");
  const [adjustmentValue, setAdjustmentValue] = useState<string>("0");
  const [roundingMode, setRoundingMode] = useState<PriceRoundingMode>("NONE");
  const [copyPromotions, setCopyPromotions] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>("");
  const formSnapshot = JSON.stringify({ sourceMode, sourceVersionId, effectiveFrom, effectiveTo, adjustmentMode, adjustmentValue, roundingMode, copyPromotions, notes });
  const [initialFormSnapshot] = useState(formSnapshot);
  const isDirty = formSnapshot !== initialFormSnapshot;

  const effectiveSourceMode: CloneSourceMode = sourceMode === "VERSION" && !hasVersionSources ? "CATALOG" : sourceMode;
  const resolvedSourceVersionId = sourceVersionId || defaultVersionId;
  const isInvalidAdjustment =
    effectiveSourceMode !== "EMPTY" && adjustmentMode !== "NONE" && !SIGNED_DECIMAL_16_8_PATTERN.test(adjustmentValue.trim());
  const isInvalidDates =
    !effectiveFrom ||
    Number.isNaN(new Date(effectiveFrom).getTime()) ||
    (Boolean(effectiveTo) && (Number.isNaN(new Date(effectiveTo).getTime()) || new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()));
  const submitDisabled =
    isSubmitting || isInvalidDates || isInvalidAdjustment || (effectiveSourceMode === "VERSION" && !resolvedSourceVersionId);

  const submit = () => {
    if (submitDisabled) return;
    void onSubmit({
      sourceMode: effectiveSourceMode,
      sourceVersionId: effectiveSourceMode === "VERSION" ? resolvedSourceVersionId : undefined,
      effectiveFrom,
      effectiveTo: effectiveTo || undefined,
      adjustmentMode: effectiveSourceMode === "EMPTY" ? undefined : adjustmentMode,
      adjustmentValue: effectiveSourceMode !== "EMPTY" && adjustmentMode !== "NONE" ? adjustmentValue.trim() : undefined,
      roundingMode: effectiveSourceMode === "EMPTY" ? undefined : roundingMode,
      copyPromotions: effectiveSourceMode === "VERSION" ? copyPromotions : undefined,
      notes: notes.trim() || undefined,
    });
  };
  return { open, onOpenChange, detail, isSubmitting, error, t, compatibleVersionOptions, hasVersionSources, setSourceMode, setSourceVersionId, effectiveFrom, setEffectiveFrom, effectiveTo, setEffectiveTo, adjustmentMode, setAdjustmentMode, adjustmentValue, setAdjustmentValue, roundingMode, setRoundingMode, copyPromotions, setCopyPromotions, notes, setNotes, effectiveSourceMode, resolvedSourceVersionId, isInvalidAdjustment, isInvalidDates, isDirty, submitDisabled, submit };
}
