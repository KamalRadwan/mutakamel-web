"use client";

import { useRef, useState, type ReactElement, type RefObject } from "react";
import { Check, FileText, LayoutTemplate } from "lucide-react";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Input, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { useQuotationTemplateLibrary } from "../hooks/useQuotationTemplateLibrary";
import type { QuotationTemplateChoice } from "../quotation-template-library";

function QuotationTemplateIdentity({ choice }: { choice: QuotationTemplateChoice }) {
  const { lang, t } = useI18n();
  const { layoutModes, locales, scopeTypes } = t.coreOperations.templates;
  return (
    <div className="min-w-0 space-y-1">
      <p className="break-words text-sm font-medium"><bdi lang={choice.locale}>{choice.name}</bdi></p>
      <p className="break-words text-xs text-muted-foreground"><bdi>{choice.detail.code}</bdi></p>
      <p className="text-xs text-muted-foreground">
        {layoutModes[choice.layoutMode]} · {locales[choice.locale]} · {scopeTypes[choice.detail.scope.type]}
      </p>
      <p className="text-xs text-muted-foreground">{t.quotationPdf.version} {formatNumber(choice.version, lang)}</p>
    </div>
  );
}

export function QuotationTemplateGallery({ library, selected, canRead, canPreview, choose, trigger, isFocusOwnerCurrent, fallbackFocusRef }: {
  library: ReturnType<typeof useQuotationTemplateLibrary>;
  selected: QuotationTemplateChoice | null;
  canRead: boolean;
  canPreview: boolean;
  choose: (choice: QuotationTemplateChoice | null) => void;
  trigger?: ReactElement;
  isFocusOwnerCurrent?: () => boolean;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useI18n();
  const c = t.quotationPdf;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [opening, setOpening] = useState<{ trigger: HTMLButtonElement; isCurrent: () => boolean } | null>(null);

  const changeOpen = (open: boolean) => {
    if (open && triggerRef.current && isFocusOwnerCurrent) {
      setOpening({ trigger: triggerRef.current, isCurrent: isFocusOwnerCurrent });
    }
    library.setOpen(open);
  };

  const restoreFocus = (event: Event) => {
    event.preventDefault();
    // FocusScope restores focus after unmount. The same button may now represent a different actor.
    if (!opening || opening.trigger !== triggerRef.current || !opening.trigger.isConnected || !opening.isCurrent()) return;
    if (!opening.trigger.disabled) {
      opening.trigger.focus({ preventScroll: true });
    } else {
      const document = opening.trigger.ownerDocument;
      const fallback = fallbackFocusRef?.current;
      if (fallback?.isConnected && document.activeElement === document.body) fallback.focus({ preventScroll: true });
    }
  };
  const readDenied = !canRead || library.error?.status === 403;
  const sampleAllowed = !readDenied && canPreview;
  const isSelected = (choice: QuotationTemplateChoice) => selected?.templateId === choice.templateId &&
    selected.templateVersionId === choice.templateVersionId;
  const pinnedChoice = selected && !library.items.some(isSelected) ? selected : null;

  return (
    <>
      <Dialog open={library.open} onOpenChange={changeOpen}>
        {trigger ? <DialogTrigger asChild ref={triggerRef}>{trigger}</DialogTrigger> : null}
        <DialogContent size="2xl" onCloseAutoFocus={trigger ? restoreFocus : undefined} className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-[1080px] flex-col gap-5 overflow-y-auto p-6">
          <div className="pe-8">
            <DialogTitle>{c.chooseTemplate}</DialogTitle>
            <DialogDescription>{c.description}</DialogDescription>
          </div>
          <Button
            variant="ghost"
            type="button"
            aria-pressed={!selected}
            className={`flex h-auto items-center gap-4 whitespace-normal rounded-card border p-4 text-start ${!selected ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            onClick={() => choose(null)}
          >
            <span className="rounded-lg bg-primary/10 p-3 text-primary"><LayoutTemplate className="size-5" aria-hidden="true" /></span>
            <span className="flex-1">
              <span className="block text-sm font-medium">{c.defaultTemplate}</span>
              <span className="text-xs text-muted-foreground">{c.defaultHint}</span>
            </span>
            {!selected ? <Check className="size-5 text-primary" aria-hidden="true" /> : null}
          </Button>
          {readDenied ? (
            <p role="alert" className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-foreground">
              {canRead && library.error?.code === "ACCESS_POLICY_BLOCKED" ? c.libraryPolicyBlocked : c.libraryDenied}
            </p>
          ) : (
            <>
              {pinnedChoice ? (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-primary bg-primary/5 p-4">
                  <QuotationTemplateIdentity choice={pinnedChoice} />
                  <Badge tone="neutral">{c.selected}</Badge>
                </div>
              ) : null}
              <Input aria-label={c.search} placeholder={c.search} value={library.search} onChange={(event) => library.setSearch(event.target.value)} maxLength={200} />
              {library.error ? (
                <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-destructive/5 p-4 text-sm text-destructive">
                  {c.libraryUnavailable}<Button variant="outline" onClick={library.retry}>{c.retry}</Button>
                </div>
              ) : null}
              {library.loading && !library.items.length ? (
                <div role="status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <span className="sr-only">{c.loading}</span>
                  {[0, 1, 2].map((id) => <Skeleton key={id} className="h-36 rounded-card" />)}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {library.items.map((choice) => {
                    const current = isSelected(choice);
                    const identityId = `quotation-template-${choice.templateId}-${choice.templateVersionId}`;
                    return (
                      <div key={identityId} className={`flex flex-col gap-3 rounded-card border bg-card p-4 ${current ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                        <div className="flex items-start gap-3">
                          <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
                          <div id={identityId}><QuotationTemplateIdentity choice={choice} /></div>
                        </div>
                        <div className="mt-auto flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" aria-pressed={current} aria-describedby={identityId} onClick={() => choose(choice)}>
                            {current ? c.selected : c.useTemplate}
                          </Button>
                          {sampleAllowed && choice.canPreview ? (
                            <Button size="sm" variant="ghost" aria-describedby={identityId} loading={library.sampleLoading} onClick={() => void library.preview(choice)}>
                              {c.preview}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!library.loading && !library.error && !library.items.length && !library.cursor ? (
                <div className="rounded-card bg-muted/30 p-8 text-center">
                  <p className="text-sm font-medium">{c.empty}</p><p className="mt-2 text-xs text-muted-foreground">{c.emptyHint}</p>
                </div>
              ) : null}
              {library.cursor ? <Button variant="outline" loading={library.loading} onClick={library.more}>{c.more}</Button> : null}
              {sampleAllowed && library.sampleError ? <p role="alert" className="text-sm text-destructive">{c.previewFailed}</p> : null}
            </>
          )}
          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="outline" onClick={() => library.setOpen(false)}>{c.close}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={library.open && sampleAllowed && library.sample !== null} onOpenChange={library.closeSample}>
        <DialogContent size="2xl" className="flex h-[90dvh] w-[calc(100vw-2rem)] max-w-[1100px] flex-col gap-4 p-6">
          <DialogTitle>{c.sample}</DialogTitle>
          <DialogDescription>{c.sampleHint}</DialogDescription>
          {sampleAllowed && library.sample ? (
            <iframe title={c.sample} srcDoc={library.sample} sandbox="" referrerPolicy="no-referrer" className="min-h-80 w-full flex-1 rounded-lg border border-border bg-white" />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
