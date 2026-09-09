"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenCheck, CheckCircle2, CircleDashed, Clock } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  Textarea,
} from "@/design-system";
import type {
  ApplicationMutationReceipt,
  ApplicationView,
  PublishApplicationDto,
} from "../types";

type StepState = "PENDING" | "DONE" | "SKIPPED" | "DEFERRED";

interface StepOutcome {
  state: StepState;
  detail: string | null;
}

interface Props {
  isOpen: boolean;
  application: ApplicationView;
  isSubmitting: boolean;
  /** Non-null when activation is already known to be refused; `null` allows it. */
  activationBlockedReason: string | null;
  onClose: () => void;
  onPublish: (dto: PublishApplicationDto) => Promise<ApplicationMutationReceipt>;
  onActivate: (
    expectedCatalogueRevision: string,
    reason: string,
  ) => Promise<unknown>;
  onContinueToBind: () => void;
}

/**
 * Step 1 of releasing an Application: publish the current catalogue revision
 * and activate it, under one operator reason.
 *
 * Activation legitimately fails while a REQUIRED Application has no database
 * coverage — which is exactly what step 2 provides. A refused activation is
 * therefore reported as *deferred* rather than as a failure of the whole
 * command: the publication stands, and the flow continues to binding.
 */
export function ApplicationPublishActivateDialog({
  isOpen,
  application,
  isSubmitting,
  activationBlockedReason,
  onClose,
  onPublish,
  onActivate,
  onContinueToBind,
}: Props) {
  const { t } = useI18n();
  const copy = t.applications.detail.publishActivate;
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [publishOutcome, setPublishOutcome] = useState<StepOutcome | null>(null);
  const [activateOutcome, setActivateOutcome] = useState<StepOutcome | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const submissionErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setReason("");
      setReasonError(null);
      setSubmissionError(null);
      setPublishOutcome(null);
      setActivateOutcome(null);
      setIsComplete(false);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const needsPublish = application.publicationStatus === "UNPUBLISHED" || application.hasPendingDraft === true;
  const needsActivate = application.lifecycleStatus === "DRAFT";
  const republishOnly = application.hasPendingDraft === true && !needsActivate;
  const hasWork = needsPublish || needsActivate;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setReasonError(copy.reasonRequired);
      queueMicrotask(() => reasonRef.current?.focus());
      return;
    }
    setReasonError(null);
    setSubmissionError(null);

    let catalogueRevision = application.catalogueRevision;
    if (needsPublish) {
      try {
        const receipt = await onPublish({
          expectedCatalogueRevision: application.catalogueRevision,
          expectedPublicationRevision: application.publicationRevision,
          reason: normalizedReason,
        });
        catalogueRevision = receipt.catalogueRevision;
        setPublishOutcome({ state: "DONE", detail: null });
      } catch (error) {
        setPublishOutcome({ state: "PENDING", detail: null });
        setSubmissionError(readMessage(error, copy.failed));
        queueMicrotask(() => submissionErrorRef.current?.focus());
        return;
      }
    } else {
      setPublishOutcome({ state: "SKIPPED", detail: null });
    }

    setActivateOutcome(
      needsActivate
        ? await runActivation(
            onActivate,
            catalogueRevision,
            normalizedReason,
            activationBlockedReason,
          )
        : { state: "SKIPPED", detail: null },
    );
    setIsComplete(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <p className="text-xs font-semibold text-primary">{copy.stepLabel}</p>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <BookOpenCheck className="size-4 text-primary" aria-hidden="true" />
            {republishOnly ? t.applications.detail.releaseAuthority.republish : copy.title}
          </DialogTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">{republishOnly ? t.applications.detail.releaseAuthority.pendingDraftHint : copy.description}</p>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted p-3 text-xs">
            <Revision label={copy.catalogueRevisionLabel} value={application.catalogueRevision} />
            <Revision label={copy.publicationRevisionLabel} value={application.publicationRevision} />
          </dl>

          <ol className="space-y-2">
            <StepRow
              label={copy.stepPublish}
              outcome={publishOutcome ?? { state: needsPublish ? "PENDING" : "SKIPPED", detail: null }}
              copy={copy}
            />
            <StepRow
              label={copy.stepActivate}
              outcome={activateOutcome ?? { state: needsActivate ? "PENDING" : "SKIPPED", detail: null }}
              copy={copy}
            />
          </ol>

          {activateOutcome?.state === "DEFERRED" && (
            <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs leading-relaxed text-warning-subtle-foreground">
              {copy.deferredHint}
            </p>
          )}

          {!hasWork && !isComplete && (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {copy.nothingToDo}
            </p>
          )}

          {hasWork && !isComplete && (
            <Field label={copy.reason} required error={reasonError ?? undefined}>
              {(fp) => (
                <Textarea
                  {...fp}
                  ref={reasonRef}
                  autoFocus
                  required
                  invalid={Boolean(reasonError)}
                  maxLength={256}
                  rows={3}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    if (reasonError) setReasonError(null);
                  }}
                  placeholder={copy.reasonPlaceholder}
                />
              )}
            </Field>
          )}

          {submissionError && (
            <div
              ref={submissionErrorRef}
              role="alert"
              tabIndex={-1}
              className="rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {submissionError}
            </div>
          )}

          <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
              {t.applications.cancel}
            </Button>
            {isComplete || !hasWork ? (
              <Button type="button" variant="primary" onClick={onContinueToBind}>
                {copy.continueToBind}
              </Button>
            ) : (
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {republishOnly ? t.applications.detail.releaseAuthority.republish : copy.confirm}
              </Button>
            )}
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A refused activation is an outcome, not an exception: publication already
 * landed and binding is the documented way to unblock it.
 */
async function runActivation(
  onActivate: (
    expectedCatalogueRevision: string,
    reason: string,
  ) => Promise<unknown>,
  catalogueRevision: string,
  reason: string,
  activationBlockedReason: string | null,
): Promise<StepOutcome> {
  if (activationBlockedReason) {
    return { state: "DEFERRED", detail: activationBlockedReason };
  }
  try {
    await onActivate(catalogueRevision, reason);
    return { state: "DONE", detail: null };
  } catch (error) {
    return { state: "DEFERRED", detail: readMessage(error, null) };
  }
}

function Revision({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-foreground" dir="ltr">
        {value}
      </dd>
    </div>
  );
}

function StepRow({
  label,
  outcome,
  copy,
}: {
  label: string;
  outcome: StepOutcome;
  copy: {
    statePending: string;
    stateDone: string;
    stateSkipped: string;
    stateDeferred: string;
  };
}) {
  const { icon: Icon, tone, text } = STEP_PRESENTATION[outcome.state];
  return (
    <li className="rounded-md border border-border bg-muted px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Icon className={`size-3.5 ${tone}`} aria-hidden="true" />
          {label}
        </span>
        <Badge tone={STEP_PRESENTATION[outcome.state].badge}>{copy[text]}</Badge>
      </div>
      {outcome.detail && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{outcome.detail}</p>
      )}
    </li>
  );
}

const STEP_PRESENTATION = {
  PENDING: {
    icon: CircleDashed,
    tone: "text-muted-foreground",
    badge: "neutral",
    text: "statePending",
  },
  DONE: {
    icon: CheckCircle2,
    tone: "text-success",
    badge: "success",
    text: "stateDone",
  },
  SKIPPED: {
    icon: CheckCircle2,
    tone: "text-muted-foreground",
    badge: "neutral",
    text: "stateSkipped",
  },
  DEFERRED: {
    icon: Clock,
    tone: "text-warning",
    badge: "warn",
    text: "stateDeferred",
  },
} as const;

function readMessage(value: unknown, fallback: string | null): string | null {
  if (value instanceof Error) return value.message;
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }
  return fallback;
}
