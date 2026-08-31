"use client";

import { useState } from "react";
import {
  Checkbox,
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CONFIGURATION_SCOPES,
  EMPTY_DEFINITION_FORM,
  EMPTY_VERSION_FORM,
  MERGE_STRATEGIES,
  RISK_CLASSES,
  type ConfigurationDefinition,
  type ConfigurationScope,
  type DefinitionFormValues,
  type MergeStrategy,
  type RiskClass,
  type VersionFormValues,
} from "../configuration-contract";

function useDrawerLabels() {
  const { t } = useI18n();
  return {
    submit: t.trade.save,
    cancel: t.common.cancel,
    discardTitle: t.common.discardTitle,
    discardDescription: t.common.discardDescription,
    discardConfirm: t.common.discardConfirm,
    discardCancel: t.common.cancel,
  };
}

export function CreateDefinitionDrawer({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: DefinitionFormValues) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const [values, setValues] = useState<DefinitionFormValues>(EMPTY_DEFINITION_FORM);
  const change = (patch: Partial<DefinitionFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_DEFINITION_FORM);
          onClose();
        }
      }}
      title={t.trade.definitionCreateTitle}
      description={t.trade.definitionCreateDescription}
      isDirty={JSON.stringify(values) !== JSON.stringify(EMPTY_DEFINITION_FORM)}
      isSubmitting={isSubmitting}
      onSubmit={() => {
        void onSubmit(values).then((saved) => {
          if (saved) setValues(EMPTY_DEFINITION_FORM);
        });
      }}
      error={error ?? undefined}
      labels={labels}
    >
      <div className="flex flex-col gap-4">
        <Field label={t.trade.definitionKey} hint={t.trade.definitionKeyHint} required>
          <Input
            dir="ltr"
            className="font-mono"
            value={values.key}
            onChange={(event) => change({ key: event.target.value.toLowerCase() })}
            maxLength={120}
            disabled={isSubmitting}
            required
          />
        </Field>
        <Field
          label={t.trade.definitionValueSchema}
          hint={t.trade.definitionValueSchemaHint}
          required
        >
          <Textarea
            dir="ltr"
            className="font-mono"
            value={values.valueSchema}
            onChange={(event) => change({ valueSchema: event.target.value })}
            disabled={isSubmitting}
            required
          />
        </Field>
        {/* One to three of TENANT / COMPANY / BRANCH. A version whose scope is
            outside this set is a 422 TRADE.CONFIGURATION.SCOPE_FORBIDDEN. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">
            {t.trade.definitionAllowedScopes}
          </legend>
          {CONFIGURATION_SCOPES.map((scope) => (
            <label key={scope} className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={values.allowedScopes.includes(scope)}
                disabled={isSubmitting}
                onCheckedChange={(checked) =>
                  change({
                    allowedScopes: checked
                      ? [...values.allowedScopes, scope]
                      : values.allowedScopes.filter((current) => current !== scope),
                  })
                }
              />
              {t.trade[`scopeTarget_${scope}`]}
            </label>
          ))}
        </fieldset>
        <Field label={t.trade.definitionMergeStrategy} required>
          <Select
            value={values.mergeStrategy}
            onValueChange={(next) => change({ mergeStrategy: next as MergeStrategy })}
            disabled={isSubmitting}
          >
            <SelectTrigger aria-label={t.trade.definitionMergeStrategy}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MERGE_STRATEGIES.map((strategy) => (
                <SelectItem key={strategy} value={strategy}>
                  {t.trade[`mergeStrategy_${strategy}`]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.trade.definitionRiskClass} required>
          <Select
            value={values.riskClass}
            onValueChange={(next) => change({ riskClass: next as RiskClass })}
            disabled={isSubmitting}
          >
            <SelectTrigger aria-label={t.trade.definitionRiskClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_CLASSES.map((risk) => (
                <SelectItem key={risk} value={risk}>
                  {t.trade[`riskClass_${risk}`]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FormDrawer>
  );
}

export function CreateVersionDrawer({
  definition,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  definition: ConfigurationDefinition;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: VersionFormValues) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const [values, setValues] = useState<VersionFormValues>(EMPTY_VERSION_FORM);
  const change = (patch: Partial<VersionFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));
  // Only the scopes the definition itself allows: anything else is a 422
  // TRADE.CONFIGURATION.SCOPE_FORBIDDEN.
  const scopes = CONFIGURATION_SCOPES.filter((scope) => definition.allowedScopes.includes(scope));

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.trade.versionCreateTitle}
      description={t.trade.versionCreateDescription}
      isDirty={JSON.stringify(values) !== JSON.stringify(EMPTY_VERSION_FORM)}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <div className="flex flex-col gap-4">
        <Field label={t.trade.versionScopeTarget} required>
          <Select
            value={values.scopeTarget}
            onValueChange={(next) => change({ scopeTarget: next as ConfigurationScope })}
            disabled={isSubmitting}
          >
            <SelectTrigger aria-label={t.trade.versionScopeTarget}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((scope) => (
                <SelectItem key={scope} value={scope}>
                  {t.trade[`scopeTarget_${scope}`]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.trade.versionValue} hint={t.trade.versionValueHint} required>
          <Textarea
            dir="ltr"
            className="font-mono"
            value={values.value}
            onChange={(event) => change({ value: event.target.value })}
            disabled={isSubmitting}
            required
          />
        </Field>
        <Field label={t.trade.versionEffectiveFrom} required>
          <Input
            dir="ltr"
            type="datetime-local"
            value={values.effectiveFrom}
            onChange={(event) => change({ effectiveFrom: event.target.value })}
            disabled={isSubmitting}
            required
          />
        </Field>
        <Field label={t.trade.versionEffectiveTo}>
          <Input
            dir="ltr"
            type="datetime-local"
            value={values.effectiveTo}
            onChange={(event) => change({ effectiveTo: event.target.value })}
            disabled={isSubmitting}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
