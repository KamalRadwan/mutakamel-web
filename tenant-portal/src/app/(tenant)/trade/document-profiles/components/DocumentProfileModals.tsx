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
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  CREATABLE_DOCUMENT_TYPES,
  DOCUMENT_PROFILE_SCOPE_TARGETS,
  EMPTY_DOCUMENT_PROFILE_FORM,
  EMPTY_DOCUMENT_PROFILE_VERSION_FORM,
  type DocumentProfileFormValues,
  type DocumentProfileVersionFormValues,
} from "../document-profile-contract";

const drawerLabels = (t: ReturnType<typeof useI18n>["t"]) => ({
  submit: t.common.save,
  cancel: t.common.cancel,
  discardTitle: t.common.discardTitle,
  discardDescription: t.common.discardDescription,
  discardConfirm: t.common.discardConfirm,
  discardCancel: t.common.cancel,
});

export function CreateDocumentProfileModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: DocumentProfileFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<DocumentProfileFormValues>(EMPTY_DOCUMENT_PROFILE_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_DOCUMENT_PROFILE_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_DOCUMENT_PROFILE_FORM);
          onClose();
        }
      }}
      title={t.tradeGovernance.profileCreateTitle}
      description={t.tradeGovernance.profileCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={drawerLabels(t)}
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
          label={t.tradeGovernance.documentType}
          required
          hint={t.tradeGovernance.documentTypeHint}
        >
          <Select
            value={values.documentType}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                documentType: next as DocumentProfileFormValues["documentType"],
              }))
            }
          >
            <SelectTrigger aria-label={t.tradeGovernance.documentType}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CREATABLE_DOCUMENT_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.tradeGovernance.scopeTarget} required>
          <Select
            value={values.scopeTarget}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                scopeTarget: next as DocumentProfileFormValues["scopeTarget"],
              }))
            }
          >
            <SelectTrigger aria-label={t.tradeGovernance.scopeTarget}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_PROFILE_SCOPE_TARGETS.map((value) => (
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

export function CreateDocumentProfileVersionDrawer({
  profileCode,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  profileCode: string;
  onClose: () => void;
  onSubmit: (values: DocumentProfileVersionFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<DocumentProfileVersionFormValues>(
    EMPTY_DOCUMENT_PROFILE_VERSION_FORM,
  );
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_DOCUMENT_PROFILE_VERSION_FORM);

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${t.tradeGovernance.profileVersionCreateTitle} · ${profileCode}`}
      description={t.tradeGovernance.profileVersionCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={drawerLabels(t)}
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
        <Field
          label={t.tradeGovernance.requiredCases}
          hint={t.tradeGovernance.requiredCasesHint}
        >
          <Textarea
            value={values.requiredCases}
            rows={5}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, requiredCases: event.target.value }))
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

export function PublishDocumentProfileVersionModal({
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  onClose: () => void;
  onSubmit: (pointerVersion: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const [pointerVersion, setPointerVersion] = useState("0");

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.tradeGovernance.profilePublishTitle}
      description={t.tradeGovernance.profilePublishDescription}
      isDirty={pointerVersion !== "0"}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(pointerVersion)}
      error={error ?? undefined}
      labels={drawerLabels(t)}
    >
      <Field
        label={t.tradeGovernance.expectedActivePointerVersion}
        required
        hint={t.tradeGovernance.expectedActivePointerVersionHint}
      >
        <Input
          type="number"
          min={0}
          value={pointerVersion}
          disabled={isSubmitting}
          onChange={(event) => setPointerVersion(event.target.value)}
        />
      </Field>
    </FormDrawer>
  );
}
