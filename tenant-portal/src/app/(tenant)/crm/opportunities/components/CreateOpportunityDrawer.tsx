"use client";

import {
  AmbiguousOutcomePanel,
  Combobox,
  DatePicker,
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { useAmbiguousOutcomeLabels } from "../../shared/hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import { fromIsoDate, toIsoDate } from "../../shared/iso-date";
import type { OpportunityPipeline } from "../hooks/pipeline-types";
import type { useCreateOpportunity } from "../hooks/useCreateOpportunity";
import { useCustomerProfileOptions } from "../hooks/useCustomerProfileOptions";
import { isValidOpportunityAmount } from "../opportunity-write-contract";

export interface CreateOpportunityDrawerProps {
  create: ReturnType<typeof useCreateOpportunity>;
  pipelines: OpportunityPipeline[];
  branchId: string | null;
}

/**
 * `POST /opportunities` — MASTER-PLAN 8.11.
 *
 * The customer is a remote `Combobox` rather than a `Select`: a tenant can hold
 * thousands of profiles, and blacklisted ones are filtered out because the
 * service refuses them with `409 CUSTOMER_PROFILE_BLACKLISTED`.
 */
export function CreateOpportunityDrawer({
  create,
  pipelines,
  branchId,
}: CreateOpportunityDrawerProps) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const customers = useCustomerProfileOptions(branchId, create.open);
  const form = create.form;
  const amountInvalid = form ? !isValidOpportunityAmount(form.amount) : false;

  return (
    <FormDrawer
      open={create.open}
      onOpenChange={(open) => {
        if (!open) create.closeDrawer();
      }}
      title={t.crmOpportunityDetail.createTitle}
      description={t.crmOpportunityDetail.createDescription}
      isDirty={form !== null}
      isSubmitting={create.isSubmitting}
      submitDisabled={!create.isValid}
      onSubmit={() => void create.submit()}
      error={describeError(create.error) ?? undefined}
      labels={{
        submit: t.common.create,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
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

      {form && (
        <div className="flex flex-col gap-3">
          <Field label={t.crmOpportunities.customer} required>
            <Combobox
              value={form.customerProfileId || undefined}
              selectedLabel={create.customerLabel}
              onValueChange={(next) => {
                const option = customers.items.find(({ id }) => id === next);
                create.selectCustomer(next ?? "", option?.displayName ?? "");
              }}
              options={customers.items.map((profile) => ({
                value: profile.id,
                label: profile.displayName,
                description: profile.companyName ?? undefined,
              }))}
              onSearch={customers.search}
              loading={customers.isLoading}
              placeholder={t.crmOpportunityDetail.selectCustomer}
              searchPlaceholder={t.crmCustomerProfiles.search}
              loadingLabel={t.common.loading}
              emptyLabel={t.crmOpportunityDetail.noCustomers}
            />
          </Field>

          <Field label={t.crmOpportunities.pipeline} required>
            <Select
              value={form.pipelineId}
              onValueChange={(value) => {
                create.setField("pipelineId", value);
                create.setField("stageId", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.crmOpportunities.selectPipeline} />
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
            required
            hint={t.crmOpportunityDetail.stageHint}
          >
            <Select
              value={form.stageId}
              onValueChange={(value) => create.setField("stageId", value)}
              disabled={create.selectableStages.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.crmLeadConvert.selectStage} />
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

          <Field label={t.crmOpportunities.title} required>
            <Input
              value={form.title}
              onChange={(event) => create.setField("title", event.target.value)}
              maxLength={180}
            />
          </Field>

          <Field
            label={t.crmOpportunityDetail.amount}
            hint={t.crmLeadConvert.amountHint}
            error={amountInvalid ? t.crmLeadConvert.amountInvalid : undefined}
          >
            <Input
              value={form.amount}
              onChange={(event) => create.setField("amount", event.target.value)}
              inputMode="decimal"
              dir="ltr"
              aria-invalid={amountInvalid}
            />
          </Field>

          <Field
            label={t.crmLeadConvert.currencyCode}
            hint={t.crmLeadConvert.currencyHint}
          >
            <Input
              value={form.currencyCode}
              onChange={(event) =>
                create.setField("currencyCode", event.target.value)
              }
              maxLength={3}
              dir="ltr"
            />
          </Field>

          <Field label={t.crmOpportunities.expectedClose}>
            <DatePicker
              value={fromIsoDate(form.expectedCloseDate)}
              onValueChange={(next) =>
                create.setField("expectedCloseDate", toIsoDate(next))
              }
              placeholder={t.crmLeadConvert.selectDate}
              clearLabel={t.crmLeadConvert.clearDate}
            />
          </Field>
        </div>
      )}
    </FormDrawer>
  );
}
