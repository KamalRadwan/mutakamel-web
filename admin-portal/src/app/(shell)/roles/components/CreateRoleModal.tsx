"use client";

import { useI18n } from "@/i18n/I18nContext";
import { FormDrawer, Field, Input, Textarea, Button, AmbiguousOutcomePanel } from "@/design-system";
import { useCreateRoleModal } from "../hooks/useCreateRoleModal";

export function CreateRoleModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { t } = useI18n();
  const {
    name,
    setName,
    description,
    setDescription,
    isSubmitting,
    error,
    isAmbiguous,
    idempotencyKey,
    nameError,
    descriptionError,
    isDirty,
    handleSubmit,
  } = useCreateRoleModal({ onClose, onSuccess });

  const trimmedName = name.trim();

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      titleEn={t.roles.createDrawerTitle}
      titleAr={t.roles.createDrawerTitle}
      subtitleEn={t.roles.createDrawerSubtitle}
      subtitleAr={t.roles.createDrawerSubtitle}
      isSubmitting={isSubmitting || isAmbiguous}
      isDirty={isDirty}
      footerActions={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting || isAmbiguous}>
            {t.roles.cancel}
          </Button>
          <Button
            type="submit"
            form="create-role-form"
            variant="primary"
            loading={isSubmitting}
            disabled={Boolean(nameError || descriptionError) || trimmedName.length < 2}
          >
            {isAmbiguous ? t.roles.retryExactCreate : t.roles.createAndContinue}
          </Button>
        </>
      }
    >
      <form id="create-role-form" onSubmit={handleSubmit} className="space-y-4 py-1">
        {isAmbiguous && (
          <AmbiguousOutcomePanel
            idempotencyKey={idempotencyKey}
            correlationId={error?.correlationId}
            message={t.roles.createAmbiguousMessage}
            onRetryExact={() => void handleSubmit()}
            retrying={isSubmitting}
          />
        )}

        <Field label={t.roles.roleNameLabel} required error={name && nameError ? nameError : undefined}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting || isAmbiguous}
              minLength={2}
              maxLength={120}
            />
          )}
        </Field>

        <Field label={t.roles.descriptionLabel} error={descriptionError ?? undefined}>
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting || isAmbiguous}
              maxLength={2_001}
              rows={3}
            />
          )}
        </Field>
      </form>
    </FormDrawer>
  );
}
