"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { getApiRequestOutcome } from "@/lib/api/axiosClient";
import { adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  isAmbiguousWriteOutcome,
  shouldRotateWriteCommandKey,
} from "@/shared/api/write-command-recovery";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { FormDrawer, Field, Input, Textarea, Button, AmbiguousOutcomePanel } from "@/design-system";
import { rolesApi } from "../api";
import type { CreateRoleCommand } from "../contract";

interface CreateIntent {
  fingerprint: string;
  idempotencyKey: string;
  command: CreateRoleCommand;
  ambiguous: boolean;
}

export function CreateRoleModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const canCreate = adminCanAll(user, ADMIN_RBAC_CRITICAL.ROLES_CREATE);
  const intentRef = useRef<CreateIntent | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isAmbiguous, setIsAmbiguous] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | undefined>(undefined);

  const trimmedName = name.trim();
  const nameError =
    trimmedName.length > 0 && (trimmedName.length < 2 || trimmedName.length > 120)
      ? t.roles.nameLengthError
      : null;
  const descriptionError =
    description.trim().length > 2_000 ? t.roles.descriptionLengthError : null;

  const isDirty = name.trim().length > 0 || description.trim().length > 0;

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canCreate) {
      toast.error(t.roles.notAuthorized, t.roles.createForbidden);
      return;
    }
    if (trimmedName.length < 2 || nameError || descriptionError || isSubmitting) return;
    const trimmedDescription = description.trim();
    const command: CreateRoleCommand = {
      name: trimmedName,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
    };
    const fingerprint = JSON.stringify(command);
    const current = intentRef.current;
    if (current?.ambiguous && current.fingerprint !== fingerprint) return;
    const intent =
      current?.fingerprint === fingerprint
        ? current
        : {
            fingerprint,
            command,
            idempotencyKey: generateUUIDv7(),
            ambiguous: false,
          };
    intentRef.current = intent;
    setIdempotencyKey(intent.idempotencyKey);
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await rolesApi.create(command, intent.idempotencyKey);
      intentRef.current = null;
      setIsAmbiguous(false);
      setIdempotencyKey(undefined);
      toast.success(t.roles.createdTitle, t.roles.createdDescription);
      onSuccess?.();
      onClose();
      router.push(`/roles/${result.data.id}`);
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      const ambiguous =
        getApiRequestOutcome(caught) === "settled-before-session-change" ||
        isAmbiguousWriteOutcome(normalized) ||
        /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(normalized.errorCode);
      if (ambiguous) {
        intentRef.current = { ...intent, ambiguous: true };
      } else if (shouldRotateWriteCommandKey(normalized)) {
        intentRef.current = null;
        setIdempotencyKey(undefined);
      }
      setIsAmbiguous(ambiguous);
      setError(normalized);
      if (!ambiguous) {
        toast.error(t.roles.createFailedTitle, normalized.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
