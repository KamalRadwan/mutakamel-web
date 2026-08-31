"use client";

import { useState } from "react";
import { Field, FormDrawer, Input, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { EMPTY_VERSION_FORM, type VersionFormValues } from "../governance-contract";

interface GovernedVersionDrawerProps {
  definitionCode: string;
  onClose: () => void;
  onSubmit: (values: VersionFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * A new governed version.
 *
 * `content` is an unvalidated `@IsObject()` at the pipe — the rule engine
 * checks it later — so the editor takes raw JSON rather than pretending to
 * know a schema source does not state. `testCases` is **required and at least
 * one**: the server refuses a version with an empty array, so it is collected
 * here, before the first save.
 */
export function GovernedVersionDrawer({
  definitionCode,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: GovernedVersionDrawerProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<VersionFormValues>(EMPTY_VERSION_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_VERSION_FORM);

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${t.tradeGovernance.versionCreateTitle} · ${definitionCode}`}
      description={t.tradeGovernance.versionCreateDescription}
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
        <Field label={t.tradeGovernance.content} required hint={t.tradeGovernance.contentHint}>
          <Textarea
            value={values.content}
            rows={10}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, content: event.target.value }))
            }
          />
        </Field>
        <Field label={t.tradeGovernance.testCases} required hint={t.tradeGovernance.testCasesHint}>
          <Textarea
            value={values.testCases}
            rows={6}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, testCases: event.target.value }))
            }
          />
        </Field>
        <Field label={t.tradeGovernance.effectiveFrom} required>
          <Input
            type="datetime-local"
            value={values.effectiveFrom}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, effectiveFrom: event.target.value }))
            }
          />
        </Field>
        <Field label={t.tradeGovernance.effectiveTo} hint={t.tradeGovernance.effectiveToHint}>
          <Input
            type="datetime-local"
            value={values.effectiveTo}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, effectiveTo: event.target.value }))
            }
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
