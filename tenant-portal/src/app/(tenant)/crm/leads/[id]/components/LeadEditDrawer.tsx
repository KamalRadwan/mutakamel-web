"use client";

import {
  AmbiguousOutcomePanel,
  EditDrawer,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { AcquisitionSource } from "../../../acquisition-sources/acquisition-source-contract";
import { AcquisitionSourceOption } from "../../../shared/components/AcquisitionSourceIcon";
import { CrmPhoneNumberInput } from "../../../shared/components/CrmPhoneNumberInput";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../../../shared/hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import type { LeadEditForm } from "../../lead-write-contract";
import type { useLeadEdit } from "../hooks/useLeadEdit";

export interface LeadEditDrawerProps {
  edit: ReturnType<typeof useLeadEdit>;
  sources: AcquisitionSource[];
  /** Sentinel for "no acquisition source", since a `Select` item needs a value. */
  noSourceValue: string;
}

/**
 * `PATCH /leads/:id` — MASTER-PLAN 8.3.
 *
 * The fields are exactly `UpdateLeadDto`'s text and reference columns. Stage
 * and status are **not** here: both are derived server-side from
 * `POST /leads/:id/stage`, and the update DTO carries neither.
 */
export function LeadEditDrawer({ edit, sources, noSourceValue }: LeadEditDrawerProps) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const form = edit.form;

  return (
    <EditDrawer
      open={edit.open}
      onOpenChange={(open) => {
        if (!open) edit.closeDrawer();
      }}
      title={t.crmLeadDetail.editTitle}
      description={t.crmLeadDetail.editDescription}
      isDirty={edit.isDirty}
      isSubmitting={edit.isSubmitting}
      onSubmit={() => void edit.submit()}
      onRevert={edit.revert}
      error={describeError(edit.error) ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        loadErrorTitle: t.editDrawer.loadErrorTitle,
        retry: t.common.retry,
        notFoundTitle: t.editDrawer.notFoundTitle,
        notFoundBack: t.editDrawer.notFoundBack,
        revert: t.editDrawer.revert,
      }}
    >
      {edit.ambiguity && (
        <AmbiguousOutcomePanel
          operation={t.crmLeadDetail.editOperation}
          idempotencyKey={edit.ambiguity.attempt.idempotencyKey}
          description={t.crmLeadDetail.ambiguousDescription}
          correlationId={edit.ambiguity.error.correlationId}
          onRetry={() => void edit.ambiguity?.replay()}
          onDismiss={edit.dismissAmbiguity}
          labels={ambiguousLabels}
        />
      )}

      {edit.appliedUnreadable && (
        <AmbiguousOutcomePanel
          operation={t.crmLeadDetail.editOperation}
          idempotencyKey={edit.appliedUnreadable.attempt.idempotencyKey}
          description={t.crmShared.appliedUnreadableDescription}
          correlationId={edit.appliedUnreadable.error.correlationId}
          onRetry={() => edit.reconcile()}
          onDismiss={edit.dismissAppliedUnreadable}
          labels={appliedLabels}
        />
      )}

      {form && (
        <div className="flex flex-col gap-3">
          <Field label={t.crmLeads.name} required>
            <Input
              value={form.displayName}
              onChange={(event) => edit.setField("displayName", event.target.value)}
              maxLength={180}
            />
          </Field>
          <Field label={t.crmLeadDetail.firstName}>
            <Input
              value={form.firstName}
              onChange={(event) => edit.setField("firstName", event.target.value)}
              maxLength={80}
            />
          </Field>
          <Field label={t.crmLeadDetail.lastName}>
            <Input
              value={form.lastName}
              onChange={(event) => edit.setField("lastName", event.target.value)}
              maxLength={80}
            />
          </Field>
          <Field label={t.crmLeadDetail.honorificTitle}>
            <Input
              value={form.honorificTitle}
              onChange={(event) => edit.setField("honorificTitle", event.target.value)}
              maxLength={40}
            />
          </Field>
          <Field label={t.crmLeads.companyName}>
            <Input
              value={form.companyName}
              onChange={(event) => edit.setField("companyName", event.target.value)}
              maxLength={180}
            />
          </Field>
          <Field label={t.crmLeads.phone}>
            <CrmPhoneNumberInput
              value={form.primaryMobile}
              maxLength={32}
              onChange={(next) => edit.setField("primaryMobile", next)}
              // The control takes an `onBlur` for the create forms' touched
              // tracking. This drawer has none: its errors come back from
              // `PATCH /leads/:id`, so there is nothing a blur could mark.
              onBlur={() => undefined}
            />
          </Field>
          <Field label={t.crmLeads.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => edit.setField("email", event.target.value)}
              maxLength={180}
            />
          </Field>
          <Field label={t.crmLeads.source}>
            <Select
              value={form.acquisitionSourceId || noSourceValue}
              onValueChange={(value) =>
                edit.setField(
                  "acquisitionSourceId",
                  value === noSourceValue ? "" : value,
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t.crmLeadDetail.noSource} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noSourceValue}>
                  <AcquisitionSourceOption source={null} label={t.crmLeadDetail.noSource} />
                </SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    <AcquisitionSourceOption source={source} label={localizedName(source, lang)} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <LeadEditTextArea
            label={t.crmLeadDetail.interestSummary}
            value={form.interestSummary}
            maxLength={4000}
            onChange={(value) => edit.setField("interestSummary", value)}
          />
          <LeadEditTextArea
            label={t.crmLeadDetail.expectedNeed}
            value={form.expectedNeed}
            maxLength={4000}
            onChange={(value) => edit.setField("expectedNeed", value)}
          />
          <LeadEditTextArea
            label={t.crmLeadDetail.description}
            value={form.description}
            maxLength={2000}
            onChange={(value) => edit.setField("description", value)}
          />
        </div>
      )}
    </EditDrawer>
  );
}

function LeadEditTextArea({
  label,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  value: LeadEditForm[keyof LeadEditForm];
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Textarea
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
