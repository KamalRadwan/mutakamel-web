"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { useLeadContactsEdit } from "../hooks/useLeadContactsEdit";
import { LeadContactReadCard } from "./LeadContactList";
import type { LeadContactsCardProps } from "./LeadContactsCard";
import { LeadIndividualContactFields } from "./LeadIndividualContactFields";

export function LeadIndividualContactCard({
  lead,
  canEdit,
  onSaved,
  onReconcile,
}: LeadContactsCardProps) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const edit = useLeadContactsEdit(lead, onSaved, onReconcile, canEdit);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const errorText = describeError(edit.error);

  const handleRequestCancel = () => {
    if (edit.saving) return;
    if (edit.isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    edit.cancel();
  };

  return (
    <div className="min-w-0 sm:col-span-2">
      {!edit.form ? (
        <LeadContactReadCard
          name={lead.displayName}
          jobTitle={null}
          email={lead.email}
          country={lead.address?.country ?? undefined}
          phones={
            lead.phones.length > 0
              ? lead.phones
              : lead.primaryMobile
                ? [lead.primaryMobile]
                : []
          }
          onEdit={canEdit ? edit.startEdit : undefined}
        />
      ) : (
        <>
          <div
            role="dialog"
            aria-label={t.crmLeadDetail.editContact}
            className="dossier-contact-card editing min-w-0"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted text-foreground"
                  aria-hidden="true"
                >
                  <Pencil className="size-3.5" />
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {t.crmLeadDetail.editContact}
                </span>
                <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                  {lead.displayName}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="dossier-btn dossier-btn-cancel"
                  aria-label={t.common.cancel}
                  disabled={edit.saving}
                  onClick={handleRequestCancel}
                >
                  <X className="size-3.5" aria-hidden="true" />
                  <span>{t.common.cancel}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="dossier-btn dossier-btn-save"
                  aria-label={t.common.save}
                  disabled={edit.saving}
                  onClick={() => void edit.save()}
                >
                  <Check className="size-3.5" aria-hidden="true" />
                  <span>{t.common.save}</span>
                </Button>
              </div>
            </div>

            {errorText && (
              <div
                role="alert"
                className="mb-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {errorText}
              </div>
            )}

            <LeadIndividualContactFields
              lead={lead}
              edit={edit}
              disabled={edit.saving}
            />
          </div>

          <AlertDialog
            open={confirmDiscardOpen}
            onOpenChange={setConfirmDiscardOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.common.discardTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.common.discardDescription}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setConfirmDiscardOpen(false);
                    edit.cancel();
                  }}
                >
                  {t.common.discardConfirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
