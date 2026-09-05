"use client";

import { useMemo } from "react";
import {
  AmbiguousOutcomePanel,
  Combobox,
  DatePicker,
  DegradedBanner,
  Field,
  FormModal,
  FormSection,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  type FormModalSection,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { CrmCustomFieldsFormSection } from "../../shared/components/CrmCustomFieldsFormSection";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../../shared/hooks/useAmbiguousOutcomeLabels";
import type { useCrmCreateCustomFields } from "../../shared/hooks/useCrmCreateCustomFields";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import { fromIsoDate, toIsoDate } from "../../shared/iso-date";
import type { OpportunityPipeline } from "../hooks/pipeline-types";
import type { useCreateOpportunity } from "../hooks/useCreateOpportunity";
import { useCustomerProfileOptions } from "../hooks/useCustomerProfileOptions";
import {
  OPPORTUNITY_SECTION_IDS,
  type OpportunitySectionId,
} from "../opportunity-create-validation";

export interface CreateOpportunityModalProps {
  create: ReturnType<typeof useCreateOpportunity>;
  pipelines: OpportunityPipeline[];
  branchId: string | null;
  customFields: ReturnType<typeof useCrmCreateCustomFields>;
}

/**
 * Creating an opportunity, on the whole viewport.
 *
 * The drawer this replaces modelled ten fields and rendered seven of them:
 * `importance`, `probabilityPercent` and `description` were in its form type
 * and on no screen. The tenant's own custom fields were absent entirely, which
 * on a tenant with a required-on-create definition made the screen impossible
 * to submit. See docs/design/patterns.md#formmodal.
 *
 * The customer is a remote `Combobox` rather than a `Select`: a tenant can hold
 * thousands of profiles, and blacklisted ones are filtered out because the
 * service refuses them with `409 CUSTOMER_PROFILE_BLACKLISTED`.
 */
export function CreateOpportunityModal({
  create,
  pipelines,
  branchId,
  customFields,
}: CreateOpportunityModalProps) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const customers = useCustomerProfileOptions(branchId, create.open);
  const { form, errors } = create;

  const visibleSections = useMemo<OpportunitySectionId[]>(
    () =>
      OPPORTUNITY_SECTION_IDS.filter(
        (section) => section !== "customFields" || customFields.definitions.length > 0,
      ),
    [customFields.definitions.length],
  );

  const indexEntries = useMemo<FormModalSection[]>(
    () =>
      visibleSections.map((section) => ({
        id: section,
        label: t.crmOpportunityDetail.create.sections[section],
        invalid: create.sectionErrorCount(section) > 0,
      })),
    [visibleSections, create, t],
  );

  const errorCount = Object.keys(errors).length;

  return (
    <FormModal
      open={create.open}
      onOpenChange={(open) => {
        if (!open) create.closeModal();
      }}
      title={t.crmOpportunityDetail.createTitle}
      description={t.crmOpportunityDetail.createDescription}
      isDirty={create.isDirty}
      isSubmitting={create.isSubmitting}
      onSubmit={() => void create.submit()}
      error={describeError(create.error) ?? undefined}
      sections={indexEntries}
      labels={{
        submit: t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav,
        sectionInvalid: t.crmShared.formSectionInvalid,
        close: t.common.close,
      }}
      footerLeading={
        errorCount > 0 ? (
          <p role="status" className="text-xs text-destructive">
            {formatTemplate(t.crmShared.formErrorCount, { count: errorCount })}
          </p>
        ) : undefined
      }
    >
      {create.ambiguity && (
        <AmbiguousOutcomePanel
          operation={t.crmOpportunityDetail.createOperation}
          idempotencyKey={create.ambiguity.attempt.idempotencyKey}
          description={t.crmOpportunityDetail.ambiguousDescription}
          correlationId={create.ambiguity.error.correlationId}
          onRetry={() => void create.ambiguity?.replay()}
          onDismiss={create.dismissAmbiguity}
          labels={ambiguousLabels}
        />
      )}

      {create.appliedUnreadable && (
        <AmbiguousOutcomePanel
          operation={t.crmOpportunityDetail.createOperation}
          idempotencyKey={create.appliedUnreadable.attempt.idempotencyKey}
          description={t.crmShared.appliedUnreadableDescription}
          correlationId={create.appliedUnreadable.error.correlationId}
          onRetry={() => create.reconcile()}
          onDismiss={create.dismissAppliedUnreadable}
          labels={appliedLabels}
        />
      )}

      {customFields.degraded && (
        <DegradedBanner message={t.crmShared.customFieldsUnavailable} />
      )}

      <FormSection
        id="placement"
        title={t.crmOpportunityDetail.create.sections.placement}
        description={t.crmOpportunityDetail.create.placementDescription}
        columns={3}
      >
        <Field
          label={t.crmOpportunities.customer}
          error={errors.customerProfileId}
          required
          className="xl:col-span-1 md:col-span-2"
        >
          <Combobox
            value={form.customerProfileId || undefined}
            selectedLabel={create.customerLabel}
            onValueChange={(next) => {
              const option = customers.items.find(({ id }) => id === next);
              create.selectCustomer(next ?? "", option?.displayName ?? "");
              create.touch("customerProfileId");
            }}
            options={customers.items.map((profile) => ({
              value: profile.id,
              label: profile.displayName,
              description: profile.companyName ?? undefined,
            }))}
            onSearch={customers.search}
            loading={customers.isLoading}
            disabled={create.isSubmitting}
            placeholder={t.crmOpportunityDetail.selectCustomer}
            searchPlaceholder={t.crmCustomerProfiles.search}
            loadingLabel={t.common.loading}
            emptyLabel={t.crmOpportunityDetail.noCustomers}
          />
        </Field>

        <Field label={t.crmOpportunities.pipeline} error={errors.pipelineId} required>
          <Select
            value={form.pipelineId}
            disabled={create.isSubmitting}
            onValueChange={(value) => {
              create.selectPipeline(value);
              create.touch("pipelineId");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {localizedName(pipeline, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={t.crmOpportunities.stage}
          hint={t.crmOpportunityDetail.stageHint}
          error={errors.stageId}
          required
        >
          <Select
            value={form.stageId}
            disabled={create.isSubmitting || create.selectableStages.length === 0}
            onValueChange={(value) => {
              create.setField("stageId", value);
              create.touch("stageId");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {create.selectableStages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {localizedName(stage, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormSection>

      <FormSection
        id="deal"
        title={t.crmOpportunityDetail.create.sections.deal}
        description={t.crmOpportunityDetail.create.dealDescription}
        columns={3}
      >
        <Field
          label={t.crmOpportunities.title}
          error={errors.title}
          required
          className="md:col-span-2"
        >
          <Input
            value={form.title}
            maxLength={180}
            disabled={create.isSubmitting}
            onChange={(event) => create.setField("title", event.target.value)}
            onBlur={() => create.touch("title")}
          />
        </Field>

        <Field
          label={t.crmOpportunityDetail.amount}
          hint={t.crmLeadConvert.amountHint}
          error={errors.amount}
        >
          <Input
            value={form.amount}
            inputMode="decimal"
            dir="ltr"
            disabled={create.isSubmitting}
            onChange={(event) => create.setField("amount", event.target.value)}
            onBlur={() => create.touch("amount")}
          />
        </Field>

        <Field
          label={t.crmLeadConvert.currencyCode}
          hint={t.crmLeadConvert.currencyHint}
          error={errors.currencyCode}
        >
          <Input
            value={form.currencyCode}
            maxLength={3}
            dir="ltr"
            disabled={create.isSubmitting}
            onChange={(event) => create.setField("currencyCode", event.target.value)}
            onBlur={() => create.touch("currencyCode")}
          />
        </Field>

        <Field label={t.crmOpportunities.expectedClose}>
          <DatePicker
            value={fromIsoDate(form.expectedCloseDate)}
            onValueChange={(next) => create.setField("expectedCloseDate", toIsoDate(next))}
            placeholder={t.crmLeadConvert.selectDate}
            clearLabel={t.crmLeadConvert.clearDate}
          />
        </Field>

        <Field
          label={t.crmOpportunities.importance}
          hint={t.crmOpportunityDetail.create.importanceHint}
          error={errors.importance}
        >
          <Input
            value={form.importance}
            inputMode="numeric"
            dir="ltr"
            className="tabular-nums"
            disabled={create.isSubmitting}
            onChange={(event) => create.setField("importance", event.target.value)}
            onBlur={() => create.touch("importance")}
          />
        </Field>

        <Field
          label={t.crmOpportunityDetail.create.probabilityPercent}
          hint={t.crmOpportunityDetail.create.probabilityHint}
          error={errors.probabilityPercent}
        >
          <Input
            value={form.probabilityPercent}
            inputMode="numeric"
            dir="ltr"
            className="tabular-nums"
            disabled={create.isSubmitting}
            onChange={(event) => create.setField("probabilityPercent", event.target.value)}
            onBlur={() => create.touch("probabilityPercent")}
          />
        </Field>
      </FormSection>

      <FormSection
        id="notes"
        title={t.crmOpportunityDetail.create.sections.notes}
        description={t.crmOpportunityDetail.create.notesDescription}
        columns={1}
      >
        <Field
          label={t.crmLeads.create.description}
          error={errors.description}
          className="max-w-prose"
        >
          <Textarea
            rows={4}
            value={form.description}
            maxLength={2000}
            disabled={create.isSubmitting}
            onChange={(event) => create.setField("description", event.target.value)}
            onBlur={() => create.touch("description")}
          />
        </Field>
      </FormSection>

      {customFields.definitions.length > 0 && (
        <CrmCustomFieldsFormSection
          definitions={customFields.definitions}
          requiredFieldKeys={customFields.requiredFieldKeys}
          values={form.customFields}
          errors={errors}
          disabled={create.isSubmitting}
          onChange={create.setCustomField}
          onBlur={create.touch}
        />
      )}
    </FormModal>
  );
}
