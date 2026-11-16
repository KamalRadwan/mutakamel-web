"use client";
import { useEffect, useMemo } from "react";
import type { MovementReferences } from "./useMovementWorkspace";
import type { SessionMovementEntry } from "../movements-contract";
import { useI18n } from "@/i18n/I18nContext";
import { INTL_LOCALE } from "@/lib/format/locale";

export function useMovementLinesReview(target: SessionMovementEntry, references?: MovementReferences) {
  const { lang } = useI18n();
  const units = useMemo(() => [...new Set((target.lines ?? []).flatMap(line =>
    [line.uomId, line.normalizedUomId].filter((id): id is string => Boolean(id))))], [target.lines]);
  const ensureUom = references?.ensureUom;
  useEffect(() => {
    if (ensureUom) units.forEach(id => { void ensureUom(id).catch(() => undefined); });
  }, [ensureUom, units]);
  return { formatExpiry: (value: string) => new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    dateStyle: "medium", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`)) };
}
