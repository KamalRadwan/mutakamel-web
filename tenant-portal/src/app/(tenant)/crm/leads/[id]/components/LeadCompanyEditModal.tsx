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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FormSection,
  Input,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { LeadAddressSection } from "../../components/create-lead/LeadAddressSection";
import type { LeadCompanyField } from "../../lead-write-contract";
import type { LeadCompanyEdit } from "../hooks/useLeadCompanyEdit";
import type { LeadCompanyModalState } from "../hooks/useLeadCompanyModal";
import { COMPANY_FIELDS, COMPANY_FIELD_LIMITS } from "../lead-company-modal-contract";

/**
 * Dossier 360° Inline Company & Split Phones Editor (Case 2).
 * Replaces the read-only Company Details card in-place when editing is active.
 */
export function LeadCompanyEditModal({ state, edit, readOnly }: {
  state: LeadCompanyModalState;
  edit: LeadCompanyEdit;
  readOnly: boolean;
}) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const describeError = useCrmErrorText();
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const { form } = state;
  if (!form) return null;
  const disabled = state.saving || readOnly || edit.reconciliationRequired;
  const labels: Record<LeadCompanyField, string> = {
    companyName: t.crmLeads.companyName,
    taxNumber: t.crmLeads.create.taxNumber,
    commercialRegistrationNumber: t.crmLeads.create.commercialRegistrationNumber,
    companyEmail: t.crmLeadDetail.companyEmail,
    companyWebsite: t.crmLeadDetail.companyWebsite,
  };
  const errorMessage = edit.error ? describeError(edit.error) ?? t.crmLeadDetail.saveFailed : undefined;

  function requestClose() {
    if (state.saving) return;
    if (state.isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    state.close();
  }

  return (
    <>
      <Card
        role="dialog"
        aria-label={t.crmLeadDetail.editCompany}
        className="dossier-card dossier-card-indigo dossier-card-editing"
      >
        <CardHeader className="dossier-card-head dossier-card-header-editing-indigo flex-row items-center justify-between gap-2">
          <div className="dossier-card-title">
            <span className="dossier-icon-pill dossier-ip-indigo" aria-hidden="true">
              <Pencil className="size-3.5" aria-hidden="true" />
            </span>
            <CardTitle className="text-xs font-extrabold tracking-wider text-indigo-900 uppercase dark:text-indigo-200">
              {t.crmLeadDetail.editCompany}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={state.saving}
              onClick={requestClose}
              aria-label={t.common.cancel}
              className="dossier-btn-cancel"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>{t.common.cancel}</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void state.save()}
              aria-label={t.crmLeadDetail.saveCompany}
              className="dossier-btn-save"
            >
              <Check className="size-3.5" aria-hidden="true" />
              <span>{t.crmLeadDetail.saveCompany}</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="dossier-card-body flex flex-col gap-3">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive-subtle px-3 py-2 text-xs font-semibold text-destructive-subtle-foreground"
            >
              {errorMessage}
            </div>
          )}

          {/* Split Phone Edit Panel (Country Code Combobox + National Number) */}
          <div className="dossier-phone-box-edit mb-0">
            <CrmPhoneListField
              label={t.crmLeadDetail.companyPhones}
              phones={form.phones}
              path="companyPhones"
              errors={state.errors}
              disabled={disabled}
              onChange={state.setPhone}
              onAdd={state.addPhone}
              onRemove={state.removePhone}
              onBlur={() => {}}
            />
            <p className="dossier-phone-hint">
              {isAr
                ? "✓ يفصل كود الدولة تلقائياً ويحذف الصفر المحلي ويدعم لصق الأرقام الدولية"
                : "✓ Auto-splits country code & strips trunk 0 · ✓ Supports pasting full international numbers"}
            </p>
          </div>

          {/* 2-Column Company Fields Grid */}
          <FormSection id="company" title={t.crmLeadDetail.companyTitle} columns={2}>
            {COMPANY_FIELDS.map((field) => (
              <div
                key={field}
                className={cn(
                  "dossier-field-box",
                  field === "companyWebsite" && "sm:col-span-2",
                )}
              >
                <Field
                  label={labels[field]}
                  error={state.errors[field]}
                  required={field === "companyName"}
                >
                  <Input
                    size="sm"
                    placeholder={labels[field]}
                    value={form[field]}
                    dir={field === "companyName" ? undefined : "ltr"}
                    maxLength={COMPANY_FIELD_LIMITS[field]}
                    disabled={disabled}
                    onChange={(event) => state.setField(field, event.target.value)}
                  />
                </Field>
              </div>
            ))}
          </FormSection>

          {/* Structured Legal Address Box */}
          <div className="dossier-address-edit-box">
            {!state.canEditAddress && (
              <p className="mb-2 text-xs text-muted-foreground">
                {t.crmLeadDetail.companyAddressTypeReadOnly}
              </p>
            )}
            {state.errors.address && (
              <p role="alert" className="mb-2 text-xs text-destructive">
                {state.errors.address}
              </p>
            )}
            <LeadAddressSection
              address={form.address}
              errors={state.errors}
              disabled={disabled || !state.canEditAddress}
              onChange={state.setAddressField}
              onBlur={() => {}}
            />
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.discardTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.common.discardDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscardOpen(false);
                state.close();
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

