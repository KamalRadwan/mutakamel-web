"use client";

import { useState } from "react";
import {
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
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  GOVERNANCE_SCOPE_TARGETS,
  POLICY_KINDS,
  WORKFLOW_KINDS,
  emptyDefinitionForm,
  type DefinitionFormValues,
  type GovernanceFamily,
} from "../governance-contract";

interface CreateDefinitionModalProps {
  family: GovernanceFamily;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: DefinitionFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateDefinitionModal({
  family,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateDefinitionModalProps) {
  const { t } = useI18n();
  const initial = emptyDefinitionForm(family);
  const [values, setValues] = useState<DefinitionFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);
  const kinds: readonly string[] = family === "policy" ? POLICY_KINDS : WORKFLOW_KINDS;

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(initial);
          onClose();
        }
      }}
      title={
        family === "policy"
          ? t.tradeGovernance.policyCreateTitle
          : t.tradeGovernance.workflowCreateTitle
      }
      description={t.tradeGovernance.definitionCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-3">
        <Field label={t.tradeGovernance.code} required hint={t.tradeGovernance.codeHint}>
          <Input
            value={values.code}
            maxLength={100}
            disabled={isSubmitting}
            onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
          />
        </Field>
        <Field
          label={family === "policy" ? t.tradeGovernance.policyKind : t.tradeGovernance.workflowKind}
          required
        >
          <Select
            value={values.kind}
            disabled={isSubmitting}
            onValueChange={(next) => setValues((current) => ({ ...current, kind: next }))}
          >
            <SelectTrigger aria-label={t.tradeGovernance.policyKind}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kinds.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={t.tradeGovernance.scopeTarget}
          required
          hint={t.tradeGovernance.scopeTargetHint}
        >
          <Select
            value={values.scopeTarget}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                scopeTarget: next as DefinitionFormValues["scopeTarget"],
              }))
            }
          >
            <SelectTrigger aria-label={t.tradeGovernance.scopeTarget}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOVERNANCE_SCOPE_TARGETS.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FormDrawer>
  );
}
