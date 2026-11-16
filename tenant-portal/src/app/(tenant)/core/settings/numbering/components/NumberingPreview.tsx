"use client";

import { Info, RefreshCw } from "lucide-react";
import { Button, IdentifierText, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  formatNumberingValue,
  normalizeNumberingPrefix,
  paddingOrNull,
  type NumberingFormValues,
} from "../numbering-contract";
import { useNumberingPeek, type NumberingPeekStatus } from "../hooks/useNumberingPeek";

interface NumberingPreviewProps {
  readonly values: NumberingFormValues;
  readonly showServerValue: boolean;
}

/**
 * The point of this screen (MASTER-PLAN 5.5).
 *
 * Two surfaces, and the difference between them matters:
 *
 * - **Preview** applies the server's own `format()` rule to what the form
 *   currently holds, so prefix, padding and counter are visible before
 *   anything is saved — never converting the `bigint` string to `Number`.
 * - **On the server** is `GET /numbering/:code/peek` verbatim — its
 *   `formatted` string, at the currently saved prefix and padding. It consumes
 *   nothing and is shown only when editing an existing sequence.
 */
export function NumberingPreview({ values, showServerValue }: NumberingPreviewProps) {
  const { t } = useI18n();
  const { peek, status, retry } = useNumberingPeek(values.code, values.companyId, showServerValue);
  const prefix = normalizeNumberingPrefix(values.prefix);
  const padding = paddingOrNull(values.padding);
  const counter = values.startValue.trim();

  const preview =
    prefix !== null && padding !== null && /^\d+$/u.test(counter) && !/^0+$/u.test(counter)
      ? formatNumberingValue(prefix, padding, counter.replace(/^0+(?=\d)/u, ""))
      : null;

  if (!showServerValue) {
    return (
      <section className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/50 p-3">
        <h3 className="text-xs font-medium text-muted-foreground">
          {t.coreSettings.numberingPreviewTitle}
        </h3>
        <p
          className="rounded-sm border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground"
          data-testid="numbering-preview"
        >
          <IdentifierText>{preview ?? t.coreSettings.numberingPreviewIncomplete}</IdentifierText>
        </p>
        <p className="text-xs text-muted-foreground">{t.coreSettings.numberingStartValueHint}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 p-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col justify-between gap-1.5 rounded-sm border border-border bg-card p-2.5">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t.coreSettings.numberingPeekLabel}
          </h3>
          <div className="flex min-h-5 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <PeekValue
              status={status}
              formatted={peek?.formatted ?? null}
              onRetry={retry}
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-1.5 rounded-sm border border-primary/25 bg-accent/60 p-2.5">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t.coreSettings.numberingDraftPreviewLabel}
          </h3>
          <p className="min-h-5 text-sm font-medium text-foreground" data-testid="numbering-preview">
            <IdentifierText>{preview ?? t.coreSettings.numberingPreviewIncomplete}</IdentifierText>
          </p>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{t.coreSettings.numberingPeekNonConsumingHint}</span>
      </p>
    </section>
  );
}

function PeekValue({
  status,
  formatted,
  onRetry,
}: {
  readonly status: NumberingPeekStatus;
  readonly formatted: string | null;
  readonly onRetry: () => void;
}) {
  const { t } = useI18n();

  if (status === "idle") return <span>{t.coreSettings.numberingPeekIdle}</span>;
  if (status === "loading") return <Skeleton className="h-4 w-28" />;
  if (status === "notFound") {
    return <span className="text-xs text-muted-foreground">{t.editDrawer.notFoundTitle}</span>;
  }
  if (status === "failed" || formatted === null) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-destructive">
        <span>{t.coreSettings.numberingPeekFailed}</span>
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          <RefreshCw className="size-3" aria-hidden="true" />
          {t.common.retry}
        </Button>
      </span>
    );
  }

  return <IdentifierText className="text-sm font-medium text-foreground">{formatted}</IdentifierText>;
}
