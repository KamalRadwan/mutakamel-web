"use client";

import {
  DatePicker,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  DetailSection,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { OpportunityPipeline, OpportunityStage } from "../../../opportunities/hooks/pipeline-types";
import { fromIsoDate, toIsoDate } from "../../../shared/iso-date";
import { isValidConversionAmount, type LeadConversionForm } from "../../lead-write-contract";
import { CRM_PROFILE_TYPES } from "../../lead-contract";

export interface ConversionStepProps {
  form: LeadConversionForm;
  setField: <K extends keyof LeadConversionForm>(
    key: K,
    value: LeadConversionForm[K],
  ) => void;
}

export function ConversionProfileStep({ form, setField }: ConversionStepProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      <Field label={t.crmLeadConvert.profileType} required>
        <Select
          value={form.profileType}
          onValueChange={(value) =>
            setField("profileType", value as LeadConversionForm["profileType"])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_PROFILE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t.crmCustomerProfiles.profileTypes[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {form.profileType === "CORPORATE" ? (
        <Field
          label={t.crmLeads.companyName}
          required
          hint={t.crmLeadConvert.companyNameHint}
        >
          <Input
            value={form.companyName}
            onChange={(event) => setField("companyName", event.target.value)}
            maxLength={180}
          />
        </Field>
      ) : null}
      <Field
        label={t.crmLeads.name}
        required={form.profileType === "INDIVIDUAL"}
      >
        <Input
          value={form.displayName}
          onChange={(event) => setField("displayName", event.target.value)}
          maxLength={180}
        />
      </Field>
    </div>
  );
}

export function ConversionContactStep({ form, setField }: ConversionStepProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      <Field label={t.crmLeadConvert.contactFullName} required>
        <Input
          value={form.contactFullName}
          onChange={(event) => setField("contactFullName", event.target.value)}
          maxLength={180}
        />
      </Field>
      <Field label={t.crmLeadConvert.contactJobTitle}>
        <Input
          value={form.contactJobTitle}
          onChange={(event) => setField("contactJobTitle", event.target.value)}
          maxLength={120}
        />
      </Field>
      <Field label={t.crmLeads.email}>
        <Input
          type="email"
          value={form.contactEmail}
          onChange={(event) => setField("contactEmail", event.target.value)}
          maxLength={180}
        />
      </Field>
      <DetailSection
        title={t.crmLeadConvert.contactMethods}
        description={t.crmLeadConvert.contactMethodsHint}
        columns={1}
        emptyValueLabel={t.detail.notRecorded}
        fields={form.contactMethods.map((method) => ({
          label: t.crmLeadConvert.methodTypes[method.methodType],
          value: method.value,
        }))}
      />
    </div>
  );
}

export interface ConversionOpportunityStepProps extends ConversionStepProps {
  pipelines: OpportunityPipeline[];
  stages: OpportunityStage[];
  pipelinesFailed: boolean;
}

export function ConversionOpportunityStep({
  form,
  setField,
  pipelines,
  stages,
  pipelinesFailed,
}: ConversionOpportunityStepProps) {
  const { t, lang } = useI18n();
  const amountInvalid = !isValidConversionAmount(form.amount);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-foreground">
          {t.crmLeadConvert.createOpportunity}
        </span>
        <Switch
          checked={form.createOpportunity}
          onCheckedChange={(checked) => setField("createOpportunity", checked)}
          aria-label={t.crmLeadConvert.createOpportunity}
        />
      </div>

      {form.createOpportunity && (
        <>
          <Field
            label={t.crmOpportunities.pipeline}
            required
            error={pipelinesFailed ? t.crmLeadConvert.pipelinesFailed : undefined}
          >
            <Select
              value={form.pipelineId}
              onValueChange={(value) => {
                setField("pipelineId", value);
                setField("stageId", "");
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
            hint={t.crmLeadConvert.stageHint}
          >
            <Select
              value={form.stageId}
              onValueChange={(value) => setField("stageId", value)}
              disabled={stages.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.crmLeadConvert.selectStage} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
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
              onChange={(event) => setField("title", event.target.value)}
              maxLength={180}
            />
          </Field>

          <Field
            label={t.crmLeadConvert.amount}
            error={amountInvalid ? t.crmLeadConvert.amountInvalid : undefined}
            hint={t.crmLeadConvert.amountHint}
          >
            <Input
              value={form.amount}
              onChange={(event) => setField("amount", event.target.value)}
              inputMode="decimal"
              aria-invalid={amountInvalid}
            />
          </Field>

          <Field label={t.crmLeadConvert.currencyCode} hint={t.crmLeadConvert.currencyHint}>
            <Input
              value={form.currencyCode}
              onChange={(event) => setField("currencyCode", event.target.value)}
              maxLength={3}
            />
          </Field>

          <Field label={t.crmOpportunities.expectedClose}>
            <DatePicker
              value={fromIsoDate(form.expectedCloseDate)}
              onValueChange={(next) =>
                setField("expectedCloseDate", toIsoDate(next))
              }
              placeholder={t.crmLeadConvert.selectDate}
              clearLabel={t.crmLeadConvert.clearDate}
            />
          </Field>
        </>
      )}
    </div>
  );
}
