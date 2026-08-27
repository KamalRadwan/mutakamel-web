"use client";

import { Boxes, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Boxes className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            {isAdoption
              ? t.applications.technicalProvisioning.adoptionTitle
              : t.applications.technicalProvisioning.bindingTitle}
          </DialogTitle>
          <p className="font-mono text-2xs font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-400">
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

        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4 dark:bg-brand-500/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-800 dark:text-brand-200">
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
            <p className="mt-3 text-xs leading-relaxed text-brand-700 dark:text-brand-300">
              {t.applications.technicalProvisioning.safeBoundary}
            </p>
          </div>

          <Field label={t.applications.technicalProvisioning.changeReason} required>
            {(fp) => (
              <Textarea
                {...fp}
                autoFocus
                required
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

          {(validationError || commandError) && (
            <div role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-xs text-danger-800 dark:border-danger-800/60 dark:bg-danger-950/30 dark:text-danger-200">
              <p>{validationError || commandMessage}</p>
              {commandError?.correlationId && (
                <p className="mt-1 font-mono text-xs opacity-75">
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
                className="border-warn-300 bg-warn-50 text-warn-900 hover:bg-warn-100 dark:border-warn-800 dark:bg-warn-950/30 dark:text-warn-200"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {t.applications.technicalProvisioning.retryExactIntent}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={isSubmitting || isRecoverable}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
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
      <dt className="font-semibold text-brand-700 dark:text-brand-300">{label}</dt>
      <dd className="mt-1 break-all font-mono font-semibold text-foreground" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
