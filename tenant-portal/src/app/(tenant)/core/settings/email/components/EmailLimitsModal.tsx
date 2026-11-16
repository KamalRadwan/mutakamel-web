"use client";

import { BarChart3 } from "lucide-react";
import { Field, FormModal, Input, Switch } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { EmailConfig, EmailConfigFormValues } from "../email-config-contract";
import type { EmailConfigFieldErrors } from "../email-config-messages";
import {
  buildEmailErrorSummaryItems,
  emailFieldAnchorId,
  focusEmailField,
  type EmailConfigFieldKey,
} from "../email-form-navigation";
import { EmailFormErrorSummary } from "./EmailFormErrorSummary";

const LIMITS_SUMMARY_FIELDS: readonly EmailConfigFieldKey[] = [
  "dailyQuota",
  "rateLimitPerMin",
];

interface EmailLimitsModalProps {
  open: boolean;
  config: EmailConfig;
  values: EmailConfigFormValues;
  fieldErrors: EmailConfigFieldErrors;
  formError: string | null;
  isDirty: boolean;
  isBusy: boolean;
  isSubmitting: boolean;
  readOnly: boolean;
  onChange: (patch: Partial<EmailConfigFormValues>) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EmailLimitsModal({
  open,
  config,
  values,
  fieldErrors,
  formError,
  isDirty,
  isBusy,
  isSubmitting,
  readOnly,
  onChange,
  onSave,
  onClose,
}: EmailLimitsModalProps) {
  const { t, lang } = useI18n();
  const summaryItems = buildEmailErrorSummaryItems(fieldErrors, LIMITS_SUMMARY_FIELDS, t);
  const formattedPlanDaily = formatNumber(config.planDailyQuota, lang);
  const formattedPlanPerMin = formatNumber(config.planRateLimitPerMin, lang);
  const usesPlanDaily = values.dailyQuota.trim().length === 0;
  const usesPlanPerMin = values.rateLimitPerMin.trim().length === 0;

  return (
    <FormModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      size="card"
      density="compact"
      bodyClassName="gap-3 px-4 py-3.5"
      title={t.coreSettings.emailLimitsTitle}
      isDirty={!isBusy && isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={isBusy || !isDirty}
      hideSubmit={readOnly}
      onSubmit={onSave}
      error={formError ?? undefined}
      labels={{
        submit: t.coreSettings.save,
        cancel: readOnly ? t.common.close : t.common.cancel,
        close: t.common.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav,
        sectionInvalid: t.crmShared.formSectionInvalid,
      }}
    >
      <EmailFormErrorSummary items={summaryItems} />

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
        <BarChart3 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium tabular-nums text-foreground">
            {formatTemplate(t.coreSettings.emailPlanLimitsSummary, {
              daily: formattedPlanDaily,
              perMin: formattedPlanPerMin,
            })}
          </span>
          <span className="text-muted-foreground">{t.coreSettings.emailUsePlanLimitsHint}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <LimitOverrideGroup
          fieldKey="dailyQuota"
          sectionLabel={t.coreSettings.emailDailyLimitLabel}
          inputLabel={t.coreSettings.emailCustomDailyLimitLabel}
          usePlanLabel={t.coreSettings.emailUsePlanLimits}
          maxHint={formatTemplate(t.coreSettings.emailLimitMaxHint, { max: formattedPlanDaily })}
          placeholder={formattedPlanDaily}
          value={values.dailyQuota}
          usesPlan={usesPlanDaily}
          error={fieldErrors.dailyQuota}
          disabled={isBusy}
          readOnly={readOnly}
          onValueChange={(next) => onChange({ dailyQuota: next })}
          onToggleUsePlan={(checked) => {
            if (checked) {
              onChange({ dailyQuota: "" });
              return;
            }
            if (usesPlanDaily) {
              onChange({ dailyQuota: String(config.planDailyQuota) });
            }
            focusEmailField(emailFieldAnchorId("dailyQuota"));
          }}
        />

        <LimitOverrideGroup
          fieldKey="rateLimitPerMin"
          sectionLabel={t.coreSettings.emailPerMinuteLimitLabel}
          inputLabel={t.coreSettings.emailCustomPerMinuteLimitLabel}
          usePlanLabel={t.coreSettings.emailUsePlanLimits}
          maxHint={formatTemplate(t.coreSettings.emailLimitMaxHint, { max: formattedPlanPerMin })}
          placeholder={formattedPlanPerMin}
          value={values.rateLimitPerMin}
          usesPlan={usesPlanPerMin}
          error={fieldErrors.rateLimitPerMin}
          disabled={isBusy}
          readOnly={readOnly}
          onValueChange={(next) => onChange({ rateLimitPerMin: next })}
          onToggleUsePlan={(checked) => {
            if (checked) {
              onChange({ rateLimitPerMin: "" });
              return;
            }
            if (usesPlanPerMin) {
              onChange({ rateLimitPerMin: String(config.planRateLimitPerMin) });
            }
            focusEmailField(emailFieldAnchorId("rateLimitPerMin"));
          }}
        />
      </div>
    </FormModal>
  );
}

interface LimitOverrideGroupProps {
  fieldKey: "dailyQuota" | "rateLimitPerMin";
  sectionLabel: string;
  inputLabel: string;
  usePlanLabel: string;
  maxHint: string;
  placeholder: string;
  value: string;
  usesPlan: boolean;
  error?: string;
  disabled: boolean;
  readOnly: boolean;
  onValueChange: (value: string) => void;
  onToggleUsePlan: (checked: boolean) => void;
}

function LimitOverrideGroup({
  fieldKey,
  sectionLabel,
  inputLabel,
  usePlanLabel,
  maxHint,
  placeholder,
  value,
  usesPlan,
  error,
  disabled,
  readOnly,
  onValueChange,
  onToggleUsePlan,
}: LimitOverrideGroupProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{sectionLabel}</span>
        {!readOnly ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{usePlanLabel}</span>
            <Switch
              aria-label={`${sectionLabel}: ${usePlanLabel}`}
              checked={usesPlan}
              disabled={disabled}
              onCheckedChange={onToggleUsePlan}
            />
          </div>
        ) : null}
      </div>

      <div id={emailFieldAnchorId(fieldKey)}>
        <Field label={inputLabel} showLabel hint={maxHint} error={error} readOnly={readOnly}>
          <Input
            size="sm"
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            disabled={disabled}
            readOnly={readOnly}
          />
        </Field>
      </div>
    </div>
  );
}
