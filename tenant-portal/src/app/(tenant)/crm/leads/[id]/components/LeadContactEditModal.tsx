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
  Checkbox,
  Field,
  Input,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmJobTitleField } from "../../../shared/components/CrmJobTitleField";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import type { LeadContactModal } from "../hooks/useLeadContactModal";
import { CONTACT_MODAL_LIMITS } from "../contact-modal-contract";
import { HonorificSelect, LeadContactFields } from "./LeadContactList";

export function LeadContactEditModal({ edit }: { edit: LeadContactModal }) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  if (!edit.open) return null;

  const form = edit.form;
  const disabled = edit.saving || edit.loading || edit.mustReload;
  const errorText = describeError(edit.error);

  const handleRequestCancel = () => {
    if (edit.saving) return;
    if (edit.isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    edit.close();
  };

  const identityField = (
    field: "displayName" | "firstName" | "lastName" | "email",
    label: string,
    maxLength: number,
  ) => (
    <Field label={label} error={edit.errors[field]} readOnly={!edit.canEditIdentity}>
      <Input
        size="sm"
        placeholder={label}
        value={form?.[field] ?? ""}
        disabled={disabled}
        maxLength={maxLength}
        type={field === "email" ? "email" : "text"}
        dir={field === "email" ? "ltr" : undefined}
        onChange={(event) => edit.setField(field, event.target.value)}
      />
    </Field>
  );

  return (
    <>
      <div
        role="dialog"
        aria-label={t.crmLeadDetail.editContact}
        className="dossier-contact-card editing min-w-0 sm:col-span-2"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/25 pb-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-cyan-500/35 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
              aria-hidden="true"
            >
              <Pencil className="size-3.5" />
            </span>
            <span className="text-xs font-extrabold text-foreground">
              {t.crmLeadDetail.editContact}
            </span>
            {form?.displayName && (
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                {form.displayName}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {t.crmLeadDetail.contactSharedRecord}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="dossier-btn dossier-btn-cancel"
              aria-label={t.common.cancel}
              disabled={edit.saving}
              onClick={handleRequestCancel}
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>{t.common.cancel}</span>
            </button>
            <button
              type="button"
              className="dossier-btn dossier-btn-save"
              aria-label={t.common.save}
              disabled={edit.saving || edit.loading || edit.mustReload || !form}
              onClick={() => void edit.save()}
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>{t.common.save}</span>
            </button>
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

        {edit.loading ? (
          <Skeleton className="h-60 rounded-md" />
        ) : (
          form && (
            <>
              {!edit.canEditIdentity && (
                <p className="mb-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                  {t.crmLeadDetail.contactIdentityPermission}
                </p>
              )}
              <LeadContactFields
                fields={[
                  {
                    label: t.crmLeadDetail.honorificTitle,
                    value: (
                      <Field
                        label={t.crmLeadDetail.honorificTitle}
                        error={edit.errors.honorificTitle}
                        readOnly={!edit.canEditIdentity}
                      >
                        <HonorificSelect
                          value={form.honorificTitle}
                          disabled={disabled}
                          readOnly={!edit.canEditIdentity}
                          placeholder={t.crmLeadDetail.honorificTitle}
                          onChange={(value) => edit.setField("honorificTitle", value)}
                        />
                      </Field>
                    ),
                  },
                  {
                    label: t.crmLeadDetail.fullName,
                    value: identityField(
                      "displayName",
                      t.crmLeadDetail.fullName,
                      CONTACT_MODAL_LIMITS.displayName,
                    ),
                  },
                  {
                    label: t.crmLeadDetail.firstName,
                    value: identityField(
                      "firstName",
                      t.crmLeadDetail.firstName,
                      CONTACT_MODAL_LIMITS.name,
                    ),
                  },
                  {
                    label: t.crmLeadDetail.lastName,
                    value: identityField(
                      "lastName",
                      t.crmLeadDetail.lastName,
                      CONTACT_MODAL_LIMITS.name,
                    ),
                  },
                  {
                    label: t.crmLeadConvert.contactJobTitle,
                    value: (
                      <Field
                        label={t.crmLeadConvert.contactJobTitle}
                        error={edit.errors.jobTitle}
                      >
                        <CrmJobTitleField
                          value={form.jobTitle}
                          disabled={disabled}
                          onChange={(value) => edit.setField("jobTitle", value)}
                          onBlur={() => {}}
                        />
                      </Field>
                    ),
                  },
                  {
                    label: t.crmLeads.email,
                    value: identityField(
                      "email",
                      t.crmLeads.email,
                      CONTACT_MODAL_LIMITS.value,
                    ),
                  },
                  {
                    label: t.crmLeads.phone,
                    span2: true,
                    value: edit.canEditIdentity ? (
                      <div className="dossier-phone-box-edit p-2.5">
                        <CrmPhoneListField
                          label={t.crmLeads.phone}
                          phones={form.phones.map(({ value }) => value)}
                          path="phones"
                          errors={edit.errors}
                          disabled={disabled}
                          onChange={edit.setPhone}
                          onAdd={edit.addPhone}
                          onRemove={edit.removePhone}
                          onBlur={() => {}}
                        />
                      </div>
                    ) : (
                      form.phones.map(({ value }) => value).join(" / ")
                    ),
                  },
                  {
                    label: t.crmLeadDetail.primaryContact,
                    span2: true,
                    value: (
                      <Field
                        label={t.crmLeadDetail.primaryContact}
                        error={edit.errors.isPrimary}
                      >
                        <Checkbox
                          checked={form.isPrimary}
                          disabled={disabled}
                          onCheckedChange={(checked) =>
                            edit.setField("isPrimary", checked === true)
                          }
                        />
                      </Field>
                    ),
                  },
                ]}
              />
              {edit.errors.phones && (
                <p role="alert" className="mt-1.5 text-xs text-destructive">
                  {edit.errors.phones}
                </p>
              )}
              {edit.errors.contacts && (
                <p role="alert" className="mt-1.5 text-xs text-destructive">
                  {edit.errors.contacts}
                </p>
              )}
            </>
          )
        )}
        {edit.mustReload && (
          <div className="mt-2.5 flex flex-col items-start gap-2">
            <p role="alert" className="text-sm text-destructive">
              {edit.failure === "partial"
                ? t.crmLeadDetail.contactPartialSave
                : t.crmLeadDetail.contactReloadRequired}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={edit.loading || edit.saving}
              onClick={() => void edit.reload()}
            >
              {t.common.retry}
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
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
                edit.close();
              }}
            >
              {t.common.discardConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
