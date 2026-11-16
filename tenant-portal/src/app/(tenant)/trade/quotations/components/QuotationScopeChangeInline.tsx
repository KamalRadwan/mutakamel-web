"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { QuotationComposerState } from "../hooks/useQuotationComposer";

/** Inline destructive-change protection: the dropdowns keep the committed context until the user chooses. */
export function QuotationScopeChangeInline({ composer, currentContext, requestedContext }: {
  composer: QuotationComposerState; currentContext: string; requestedContext?: string;
}) {
  const { t } = useI18n();
  const c = t.quotationFlow;
  return <div role="alert" aria-busy={composer.isChangingScope || undefined}
    className="mt-1.5 space-y-2 rounded-md border border-warning/30 bg-warning-subtle px-2.5 py-2 text-xs text-warning-subtle-foreground">
    <p className="flex items-center gap-1.5 font-medium">
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />{c.contextChangeTitle}
    </p>
    <p>{c.contextChangeDescription}</p>
    <dl className="grid gap-1 sm:grid-cols-2">
      <div><dt className="text-muted-foreground">{c.currentContext}</dt><dd className="font-medium"><bdi>{currentContext}</bdi></dd></div>
      <div><dt className="text-muted-foreground">{c.requestedContext}</dt><dd className="font-medium"><bdi>{requestedContext}</bdi></dd></div>
    </dl>
    <p className="text-muted-foreground">{c.noIdentityTransfer}</p>
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" size="xs" disabled={composer.isChangingScope} onClick={composer.cancelScopeChange}>{c.stay}</Button>
      <Button variant="outline" size="xs" disabled={composer.isChangingScope} onClick={() => void composer.confirmScopeChange(false)}>
        {c.discardAndChange}
      </Button>
      <Button variant="primary" size="xs" loading={composer.isChangingScope} disabled={!composer.canSubmit}
        onClick={() => void composer.confirmScopeChange(true)}>{c.saveAndChange}</Button>
    </div>
  </div>;
}
