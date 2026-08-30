"use client";

import { useEffect, useRef } from "react";
import { Boxes, RefreshCw, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Field, Textarea, Button } from "@/design-system";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import { useApplicationPrimaryComponentDialog } from "../hooks/useApplicationPrimaryComponentDialog";
import { deriveTechnicalIdentityPreview } from "../lib/technical-provisioning-state";

interface Props {
  isOpen: boolean;
  mode: "ADOPT" | "BIND";
  applicationKey: string;
  runtimeTarget: string | null;
  databasePrincipal: string | null;
  technicalDefinitionRevision: string;
  isSubmitting: boolean;
  commandError: NormalizedApiError | null;
  canRetryExactIntent: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
  onRetryExactIntent: () => Promise<boolean>;
  onClearCommandError: () => void;
}

export function ApplicationPrimaryComponentDialog({
  isOpen,
  mode,
  applicationKey,
  runtimeTarget,
  databasePrincipal,
  technicalDefinitionRevision,
  isSubmitting,
  commandError,
  canRetryExactIntent,
  onClose,
  onConfirm,
  onRetryExactIntent,
  onClearCommandError,
}: Props) {
  const { t } = useI18n();
  const { reason, setReason, validationError, close, submit } = useApplicationPrimaryComponentDialog({
    isOpen,
    isSubmitting,
    onClose,
    onConfirm,
    onClearCommandError,
  });
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (validationError) reasonRef.current?.focus();
  }, [validationError]);

  if (!isOpen) return null;
  const identity = deriveTechnicalIdentityPreview(applicationKey);
  const isAdoption = mode === "ADOPT";

  const isRecoverable =
    commandError?.errorCode === "GW.IDEM.IN_FLIGHT" ||
    (commandError?.httpStatus ?? 0) >= 500 ||
    commandError?.errorCode === "UNKNOWN_ERROR";
  const commandMessage = commandError?.errorCode === "APPLICATION_TECHNICAL_DEFINITION_REVISION_STALE"
    ? t.applications.technicalProvisioning.staleMessage
    : commandError?.httpStatus === 403
      ? t.applications.technicalProvisioning.forbiddenMessage
      : commandError?.message;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Boxes className="size-4 text-primary" aria-hidden="true" />
            {isAdoption
              ? t.applications.technicalProvisioning.adoptionTitle
              : t.applications.technicalProvisioning.bindingTitle}
          </DialogTitle>
          <p className="text-xs font-semibold text-primary">
            {isAdoption
              ? t.applications.technicalProvisioning.adoptionEyebrow
              : t.applications.technicalProvisioning.bindingEyebrow}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isAdoption
              ? t.applications.technicalProvisioning.adoptionDescription
              : t.applications.technicalProvisioning.bindingDescription}
          </p>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="rounded-md border border-info/30 bg-info-subtle p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-info-subtle-foreground">
              <ShieldCheck className="size-4" aria-hidden="true" />
              {t.applications.technicalProvisioning.authoritativeMapping}
            </div>
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <Mapping label={t.applications.technicalProvisioning.applicationKey} value={applicationKey} />
              <Mapping
                label={t.applications.technicalProvisioning.workerTarget}
                value={isAdoption ? identity.runtimeTarget : (runtimeTarget ?? identity.runtimeTarget)}
              />
              <Mapping
                label={t.applications.technicalProvisioning.databasePrincipal}
                value={isAdoption ? identity.databasePrincipal : (databasePrincipal ?? identity.databasePrincipal)}
              />
              <Mapping
                label={t.applications.technicalProvisioning.componentKey}
                value={identity.primaryComponentKey}
              />
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-info-subtle-foreground">
              {t.applications.technicalProvisioning.safeBoundary}
            </p>
          </div>

          <Field
            label={t.applications.technicalProvisioning.changeReason}
            required
            error={validationError ?? undefined}
          >
            {(fp) => (
              <Textarea
                {...fp}
                ref={reasonRef}
                autoFocus
                required
                invalid={Boolean(validationError)}
                maxLength={256}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t.applications.technicalProvisioning.reasonPlaceholder}
              />
            )}
          </Field>

          <p className="font-mono text-xs text-muted-foreground">
            {t.applications.technicalProvisioning.revisionLabel}: {technicalDefinitionRevision}
          </p>

          {commandError && (
            <div role="alert" className="rounded-md border border-destructive bg-destructive-subtle px-3 py-2.5 text-xs text-destructive-subtle-foreground">
              <p>{commandMessage}</p>
              {commandError?.correlationId && (
                <p className="mt-1 font-mono text-xs opacity-75" dir="ltr">
                  {t.applications.technicalProvisioning.correlationId}: {commandError.correlationId}
                </p>
              )}
            </div>
          )}

          <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>
              {t.applications.cancel}
            </Button>
            {isRecoverable && canRetryExactIntent && (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => void onRetryExactIntent().then((completed) => completed && onClose())}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {t.applications.technicalProvisioning.retryExactIntent}
              </Button>
            )}
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={isRecoverable}>
              {isSubmitting
                ? isAdoption
                  ? t.applications.technicalProvisioning.adopting
                  : t.applications.technicalProvisioning.linking
                : isAdoption
                  ? t.applications.technicalProvisioning.adoptIdentity
                  : t.applications.technicalProvisioning.linkComponent}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Mapping({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-info-subtle-foreground">{label}</dt>
      <dd className="mt-1 break-all font-mono font-semibold text-foreground" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
