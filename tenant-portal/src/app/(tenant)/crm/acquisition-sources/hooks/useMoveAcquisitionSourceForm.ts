"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { AcquisitionSource } from "../acquisition-source-contract";

export function useMoveAcquisitionSourceForm(
  source: AcquisitionSource | null,
  items: AcquisitionSource[],
  isSubmitting: boolean,
  blocked: boolean,
  onClose: () => void,
  onSubmit: (position: number) => Promise<boolean>,
) {
  const { t, lang } = useI18n();
  const sourceId = source?.id ?? null;
  const [draft, setDraft] = useState({ sourceId, position: String(source?.sortOrder ?? 1), attempted: false });
  if (draft.sourceId !== sourceId) {
    setDraft({ sourceId, position: String(source?.sortOrder ?? 1), attempted: false });
  }
  const submitting = useRef(false);
  const mounted = useRef(true);
  const currentSourceId = useRef(sourceId);
  useLayoutEffect(() => { currentSourceId.current = sourceId; });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const position = Number(draft.position);
  const valid = !!source && items.some(({ id }) => id === source.id) && /^[1-9]\d*$/.test(draft.position)
    && Number.isSafeInteger(position) && position <= items.length;
  const isDirty = !!source && draft.position !== String(source.sortOrder);
  const remaining = items.filter(({ id }) => id !== sourceId);
  const before = valid ? remaining[position - 1] : undefined;
  const preview = !isDirty || !valid ? undefined : before
    ? formatTemplate(t.crmAcquisitionSources.moveBefore, { name: localizedName(before, lang) })
    : t.crmAcquisitionSources.moveLast;

  return {
    position: draft.position,
    setPosition: (value: string) => setDraft((current) => ({ ...current, position: value })),
    positions: items.map((_item, index) => ({ value: String(index + 1), label: formatNumber(index + 1, lang) })),
    currentPosition: source ? formatNumber(source.sortOrder, lang) : "",
    error: draft.attempted && !valid ? t.crmAcquisitionSources.positionInvalid : undefined,
    isDirty,
    preview,
    submitDisabled: blocked || !isDirty || !valid,
    onOpenChange: (open: boolean) => { if (!open && !isSubmitting && !submitting.current) onClose(); },
    submit: async () => {
      if (blocked || isSubmitting || submitting.current || !source) return false;
      setDraft((current) => ({ ...current, attempted: true }));
      if (!valid || !isDirty) return false;
      submitting.current = true;
      try {
        const saved = await onSubmit(position);
        if (saved && mounted.current && currentSourceId.current === source.id) onClose();
        return saved;
      } finally { submitting.current = false; }
    },
  };
}
