"use client";

import { Badge, IdentifierText, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  formatNumberingValue,
  paddingOrNull,
  type NumberingFormValues,
} from "../numbering-contract";
import { useNumberingPeek, type NumberingPeekStatus } from "../hooks/useNumberingPeek";

interface NumberingPreviewProps {
  values: NumberingFormValues;
}

/**
 * The point of this screen (MASTER-PLAN 5.5).
 *
 * Two lines, and the difference between them matters:
 *
 * - **Preview** applies the server's own `format()` rule to what the form
 *   currently holds, so prefix, padding and start value are visible before
 *   anything is saved.
 * - **On the server** is `GET /numbering/:code/peek` verbatim — its
 *   `formatted` string, at the currently saved prefix and padding. It consumes
 *   nothing, so it refreshes as the code is typed.
 */
export function NumberingPreview({ values }: NumberingPreviewProps) {
  const { t } = useI18n();
  const { peek, status } = useNumberingPeek(values.code, values.companyId);
  const padding = paddingOrNull(values.padding);
  const counter = values.startValue.trim();

  const preview =
    padding !== null && /^\d+$/u.test(counter)
      ? formatNumberingValue(values.prefix, padding, counter)
      : null;

  return (
    <section className="flex flex-col gap-2 rounded-sm border border-border bg-muted p-3">
      <h3 className="text-xs font-medium text-muted-foreground">
        {t.coreSettings.numberingPreviewTitle}
      </h3>

      <p className="text-sm text-foreground" data-testid="numbering-preview">
        <IdentifierText>{preview ?? t.coreSettings.numberingPreviewIncomplete}</IdentifierText>
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{t.coreSettings.numberingPeekLabel}</span>
        <PeekValue status={status} formatted={peek?.formatted ?? null} nextValue={peek?.nextValue ?? null} />
      </div>
    </section>
  );
}

function PeekValue({
  status,
  formatted,
  nextValue,
}: {
  status: NumberingPeekStatus;
  formatted: string | null;
  nextValue: string | null;
}) {
  const { t } = useI18n();

  if (status === "idle") return <span>{t.coreSettings.numberingPeekIdle}</span>;
  if (status === "loading") return <Skeleton className="h-4 w-28" />;
  if (status === "notFound") return <Badge tone="neutral">{t.coreSettings.numberingPeekNew}</Badge>;
  if (status === "failed" || formatted === null || nextValue === null) {
    return <span>{t.coreSettings.numberingPeekFailed}</span>;
  }

  return (
    <IdentifierText className="text-foreground">
      {formatTemplate(t.coreSettings.numberingPeekValue, {
        formatted,
        // A bigint counter, rendered exactly as it arrived — never parsed.
        nextValue,
      })}
    </IdentifierText>
  );
}
