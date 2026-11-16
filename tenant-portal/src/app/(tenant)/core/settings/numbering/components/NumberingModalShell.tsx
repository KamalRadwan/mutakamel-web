"use client";

import { AlertTriangle, X } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  Dialog,
  DialogContent,
  DialogTitle,
  type DialogContentProps,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { NumberingSummaryErrorItem } from "../hooks/useNumberingSequenceForm";
import type { NumberingFieldKey } from "../numbering-form-validation";

interface NumberingModalShellProps {
  readonly open: boolean;
  readonly title: string;
  readonly isSubmitting: boolean;
  readonly submitDisabled?: boolean;
  readonly error: string | null;
  readonly summaryItems: readonly NumberingSummaryErrorItem[];
  readonly confirmingDiscard: boolean;
  readonly setBody: (node: HTMLDivElement | null) => void;
  readonly onOpenAutoFocus?: DialogContentProps["onOpenAutoFocus"];
  readonly onFocusField: (key: NumberingFieldKey) => void;
  readonly onRequestClose: () => void;
  readonly onConfirmDiscard: () => void;
  readonly onConfirmingDiscardChange: (open: boolean) => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly notFoundContent?: React.ReactNode;
  readonly children: React.ReactNode;
}

export function NumberingModalShell({
  open,
  title,
  isSubmitting,
  submitDisabled = false,
  error,
  summaryItems,
  confirmingDiscard,
  setBody,
  onOpenAutoFocus,
  onFocusField,
  onRequestClose,
  onConfirmDiscard,
  onConfirmingDiscardChange,
  onSubmit,
  notFoundContent,
  children,
}: NumberingModalShellProps) {
  const { t } = useI18n();
  const showSummary = summaryItems.length > 0 || Boolean(error);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onRequestClose();
        }}
      >
        <DialogContent
          size="lg"
          showCloseButton={false}
          aria-describedby={undefined}
          onOpenAutoFocus={onOpenAutoFocus}
          className="flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:p-0"
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            onRequestClose();
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            onRequestClose();
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
        >
          <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
              <DialogTitle className="min-w-0 truncate text-sm font-semibold text-foreground">
                {title}
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={t.common.close}
                disabled={isSubmitting}
                onClick={onRequestClose}
                className="size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>

            {notFoundContent ? (
              <div className="bg-card">{notFoundContent}</div>
            ) : (
              <>
                <div
                  ref={setBody}
                  className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto scroll-smooth bg-card p-4"
                >
                  {showSummary ? (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                    >
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {summaryItems.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium">
                              {formatTemplate(t.crmShared.formErrorCount, {
                                count: summaryItems.length,
                              })}
                            </span>
                            <ul className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {summaryItems.map((item) => (
                                <li key={item.key} className="inline-flex items-center">
                                  <Button
                                    asChild
                                    variant="link"
                                    size="xs"
                                    className="font-medium text-destructive underline underline-offset-2"
                                  >
                                    <a
                                      href={`#${item.anchorId}`}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        onFocusField(item.key);
                                      }}
                                    >
                                      {item.label}
                                    </a>
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {error ? <p className="min-w-0 wrap-anywhere">{error}</p> : null}
                      </div>
                    </div>
                  ) : null}

                  {children}
                </div>

                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-card px-4 py-2.5">
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={onRequestClose}
                    disabled={isSubmitting}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    disabled={submitDisabled}
                  >
                    {t.coreSettings.save}
                  </Button>
                </div>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionModal
        open={confirmingDiscard}
        onOpenChange={onConfirmingDiscardChange}
        title={t.common.discardTitle}
        description={t.common.discardDescription}
        confirmLabel={t.common.discardConfirm}
        cancelLabel={t.common.cancel}
        onConfirm={onConfirmDiscard}
      />
    </>
  );
}
